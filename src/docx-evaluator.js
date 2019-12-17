'use strict'

const { Scope, Engine } = require('yatte')
const XmlDataBuilder = require('./xmlbuilder')
const version = require('./version')
const semver = require('semver')

class XmlAssembler {
  constructor (scope) {
    this.missing = {}
    this.contextStack = null
    if (scope) {
      this.contextStack = Scope.pushObject(scope, this.contextStack)
    }
    this.xmlStack = new XmlDataBuilder()
  }

  loadTemplateModule (templateJsFile) {
    const thisVers = semver.major(version) + '.' + semver.minor(version)
    const extractedLogic = require(templateJsFile)
    const loadedVers = extractedLogic.version
    if (loadedVers && (semver.eq(version, loadedVers) || semver.satisfies(loadedVers, thisVers))) {
      return extractedLogic
    } // else
    // invalidate loaded module with incorrect version!
    delete require.cache[require.resolve(templateJsFile)]
    throw new Error(`Version mismatch: Expecting template JavaScript version ${thisVers}.x, but JS file is version ${
      loadedVers}`)
  }

  assembleXml (templateJsFile, joinstr = '') {
    const extractedLogic = this.loadTemplateModule(templateJsFile)
    extractedLogic.evaluate(this.contextStack, null, this)
    return this.xmlStack.toString(joinstr)
  }

  beginObject (ident, objContext) {
    if (objContext !== this.contextStack && typeof objContext === 'number') { // top-level object
      this.contextStack = Scope.pushListItem(objContext, this.contextStack)
      this.xmlStack.pushObject(ident) // no need to push top-level object on XML stack
    }
  }

  endObject () {
    this.contextStack = Scope.pop(this.contextStack)
    this.xmlStack.popObject()
  }

  define (ident, expr) {
    if (Scope.empty(this.contextStack)) {
      throw new Error('internal error: Cannot define a member on an empty context stack')
    }
    const frame = this.contextStack
    if (frame.frameType === Scope.LIST) {
      throw new Error('Internal error: cannot define a member on a list context')
    }

    const evaluator = Engine.compileExpr(expr) // these are cached so this should be fast
    let value = frame.evaluate(evaluator) // we need to make sure this is memoized to avoid unnecessary re-evaluation
    if (value && (typeof value === 'object') && (value.errors || value.missing)) {
      // value is a yatte EvaluationResult, probably because of nested template evaluation
      value = value.valueOf() // disregard everything but the actual evaluated value
    }
    if (value === null || typeof value === 'undefined') {
      this.missing[expr] = true
      value = '[' + expr + ']' // missing value placeholder
    }
    if (value === '') {
      this.xmlStack.set(ident, undefined)
    } else if (typeof value === 'object') { // define should only be used to output simple scalar values into XML
      this.xmlStack.set(ident, value.toString()) // probably bad input; convert to a string representation
    } else {
      this.xmlStack.set(ident, value)
    }
  }

  beginCondition (ident, expr) {
    if (Scope.empty(this.contextStack)) {
      throw new Error('internal error: Cannot define a condition on an empty context stack')
    }
    const frame = this.contextStack
    if (frame.frameType !== Scope.OBJECT) {
      throw new Error(`Internal error: cannot define a condition on a ${frame.frameType} context`)
    }
    const evaluator = Engine.compileExpr(expr) // these are cached so this should be fast
    const value = frame.evaluate(evaluator) // this ought to be memoized to avoid unnecessary re-evaluation
    const bValue = Scope.isTruthy(value)
    this.xmlStack.set(ident, bValue)
    return bValue
  }

  beginList (ident, expr) {
    const frame = this.contextStack
    const evaluator = Engine.compileExpr(expr) // these are cached so this should be fast
    const iterable = frame.evaluate(evaluator) // this ought to be memoized to avoid unnecessary re-evaluation
    this.contextStack = Scope.pushList(iterable || [], this.contextStack, ident)
    const indices = this.contextStack.indices
    this.xmlStack.pushList(ident)
    return indices
  }

  endList () {
    this.xmlStack.popList()
    this.contextStack = Scope.pop(this.contextStack)
  }
}
module.exports = XmlAssembler
