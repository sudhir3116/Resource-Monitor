const fs = require('fs');
const path = require('path');

const EXCLUDE_DIRS = ['admin', 'gm'];

function walkSync(dir, filelist = []) {
    fs.readdirSync(dir).forEach(file => {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            if (!EXCLUDE_DIRS.includes(file)) {
                walkSync(filePath, filelist);
            }
        } else if (filePath.endsWith('.jsx') || filePath.endsWith('.js')) {
            filelist.push(filePath);
        }
    });
    return filelist;
}

const pagesDir = path.join(__dirname, '..', 'src', 'pages');
if (!fs.existsSync(pagesDir)) {
    console.error(`Paths not found: ${pagesDir}`);
    process.exit(1);
}

const allFiles = walkSync(pagesDir);

const IMPORT_RULES = [
    { match: /<Button/g, check: 'import Button ', add: "import Button from '{prefix}components/common/Button';" },
    { match: /<Badge/g, check: 'import Badge ', add: "import Badge from '{prefix}components/common/Badge';" },
    { match: /<Card/g, check: 'import Card ', add: "import Card from '{prefix}components/common/Card';" },
    { match: /<Modal/g, check: 'import Modal ', add: "import Modal from '{prefix}components/common/Modal';" },
    { match: /<EmptyState/g, check: 'import EmptyState ', add: "import EmptyState from '{prefix}components/common/EmptyState';" },
    { match: /<SortIcon/g, check: 'import SortIcon ', add: "import SortIcon from '{prefix}components/common/SortIcon';" },
    { match: /<Loading/g, check: 'import Loading ', add: "import Loading from '{prefix}components/Loading';" },
    { match: /<Spinner/g, check: 'import Spinner ', add: "import Loading as Spinner from '{prefix}components/Loading';" },
    { match: /UseAuth\b/g, check: 'import { useAuth }', add: "import { useAuth } from '{prefix}context/AuthContext';" },
    { match: /AuthContext\b/g, check: 'import { AuthContext }', add: "import { AuthContext } from '{prefix}context/AuthContext';" },
    { match: /\bapi\./g, check: 'import api ', add: "import api from '{prefix}services/api';" },
];

allFiles.forEach(file => {
    let content = fs.readFileSync(file, 'utf-8');
    let originalContent = content;

    const relativeFromSrc = path.relative(path.join(__dirname, '..', 'src', 'pages'), path.dirname(file));
    const depth = relativeFromSrc === '' ? 0 : relativeFromSrc.split(path.sep).length;
    // if depth is 0 (i.e., inside pages/), prefix = '../'
    // if depth is 1 (i.e., inside pages/student/), prefix = '../../'
    const prefix = '../'.repeat(depth + 1);

    let importsToAdd = [];

    IMPORT_RULES.forEach(rule => {
        if (content.match(rule.match) && !content.includes(rule.check)) {
            importsToAdd.push(rule.add.replace('{prefix}', prefix));
        }
    });

    // Recharts
    const RECHARTS_COMPONENTS = ['LineChart', 'BarChart', 'AreaChart', 'PieChart', 'Line', 'Bar', 'Area', 'Pie', 'Cell', 'XAxis', 'YAxis', 'CartesianGrid', 'Tooltip', 'Legend', 'ResponsiveContainer'];
    let neededRecharts = [];
    RECHARTS_COMPONENTS.forEach(comp => {
        const rx = new RegExp(`<${comp}\\b`, 'g');
        if (content.match(rx)) {
            // Very naive check for recharts imports
            if (!content.includes(`import { ${comp}`) && !content.includes(comp + ' } from ') && !content.includes(comp + ',') && !content.includes(' ' + comp + ' }')) {
                neededRecharts.push(comp);
            }
        }
    });
    if (neededRecharts.length > 0) {
        importsToAdd.push(`import { ${[...new Set(neededRecharts)].join(', ')} } from 'recharts';`);
    }

    // React Router
    let neededRouter = [];
    ['useNavigate', 'NavLink', 'Link'].forEach(comp => {
        const rx = new RegExp(`\\b${comp}\\b`, 'g');
        if (content.match(rx)) {
            if (!content.includes(`import { ${comp}`) && !content.includes(comp + ' } from') && !content.includes(comp + ',') && !content.includes(' ' + comp + ' }')) {
                neededRouter.push(comp);
            }
        }
    });
    if (neededRouter.length > 0) {
        importsToAdd.push(`import { ${neededRouter.join(', ')} } from 'react-router-dom';`);
    }

    // MetricCard
    if (content.match(/<MetricCard/g) && !content.includes('MetricCard')) {
        importsToAdd.push(`import { MetricCard } from '${prefix}components/common/Card';`);
    }

    // useContext
    if (content.match(/\buseContext\(/g) && !content.includes('useContext')) {
        if (content.match(/import React/)) {
            content = content.replace(/(import React.*?)(from ['"]react['"])/, `$1, { useContext } $2`);
        } else {
            importsToAdd.push(`import { useContext } from 'react';`);
        }
    }

    // Lucide React
    const lucideMatch = content.match(/<([A-Z][a-zA-Z0-9]*)\b[^>]*\/>/g);
    // Actually, finding all lucide icons is harder. Let's just fix the imports explicitly if any are passed.
    // We'll leave it for now unless we see specific errors.

    if (importsToAdd.length > 0) {
        const newImports = importsToAdd.join('\n') + '\n';
        // insert after last import or at the top
        const importMatches = [...content.matchAll(/^import .*;?$/gm)];
        if (importMatches.length > 0) {
            const lastMatch = importMatches[importMatches.length - 1];
            const insertPos = lastMatch.index + lastMatch[0].length + 1;
            content = content.slice(0, insertPos) + newImports + content.slice(insertPos);
        } else {
            content = newImports + content;
        }
    }

    if (content !== originalContent) {
        fs.writeFileSync(file, content);
        console.log(`Updated ${file} \nAdded imports:\n${importsToAdd.join('\n')}`);
    }
});
