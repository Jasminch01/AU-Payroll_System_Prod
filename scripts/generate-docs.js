const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

const apiDir = path.join(process.cwd(), 'app', 'api');
let mdContent = '# Australia Payroll System Backend API Documentation\n\n';
mdContent += 'This document covers all currently implemented REST API endpoints for the Deputy-MVP platform, extracted directly from the codebase.\n\n';

let apiEndpoints = [];

walkDir(apiDir, function (filePath) {
    if (!filePath.endsWith('route.ts')) return;

    const content = fs.readFileSync(filePath, 'utf8');
    const regex = /\/\*\*([\s\S]*?)\*\/\s*export (?:async )?function (GET|POST|PUT|DELETE|PATCH)/g;

    let match;
    while ((match = regex.exec(content)) !== null) {
        const docBlock = match[1].replace(/^\s*\*\s?/gm, '');
        const method = match[2];
        const relativePath = filePath.replace(apiDir, '').replace(/\\/g, '/').replace(/\/route\.ts$/, '');
        const endpointRoute = `/api${relativePath || '/'}`;

        let cleanedDoc = docBlock.trim();
        if (cleanedDoc.startsWith(`${method} ${endpointRoute}`)) {
            cleanedDoc = cleanedDoc.replace(`${method} ${endpointRoute}`, '').trim();
        }

        apiEndpoints.push({
            method,
            route: endpointRoute,
            docs: cleanedDoc
        });
    }
});

apiEndpoints.sort((a, b) => a.route.localeCompare(b.route));

for (const ep of apiEndpoints) {
    mdContent += `## \`${ep.method}\` ${ep.route}\n\n`;
    mdContent += '```text\n' + ep.docs + '\n```\n\n';
    mdContent += `---\n\n`;
}

fs.writeFileSync('API_DOCUMENTATION.md', mdContent);
console.log('Successfully generated API_DOCUMENTATION.md with ' + apiEndpoints.length + ' endpoints.');
