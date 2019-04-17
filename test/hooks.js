const fs = require('fs');
const path = require('path');
const format = require('date-fns/format');

before(function() {
    const historyDir = path.join(__dirname, 'history');
    if (!fs.existsSync(historyDir))
        fs.mkdirSync(historyDir);
    testOutputDir = path.join(historyDir, format(Date.now(), 'YYYY-MM-DD HH=mm=ss')); // global
    fs.mkdirSync(testOutputDir);
    console.log(`Output of this test run at:\n    ${testOutputDir}`);
});