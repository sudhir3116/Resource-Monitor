const fs = require('fs');
const path = require('path');

const walk = function (dir, done) {
    let results = [];
    fs.readdir(dir, function (err, list) {
        if (err) return done(err);
        let pending = list.length;
        if (!pending) return done(null, results);
        list.forEach(function (file) {
            file = path.resolve(dir, file);
            fs.stat(file, function (err, stat) {
                if (stat && stat.isDirectory()) {
                    if (!file.includes('node_modules')) {
                        walk(file, function (err, res) {
                            results = results.concat(res);
                            if (!--pending) done(null, results);
                        });
                    } else {
                        if (!--pending) done(null, results);
                    }
                } else {
                    if (file.endsWith('.js')) {
                        results.push(file);
                    }
                    if (!--pending) done(null, results);
                }
            });
        });
    });
};

walk('/Users/sudhir31/Documents/VSCode/Projects/sustainable_resource_monitor/backend', function (err, results) {
    if (err) throw err;
    results.forEach(file => {
        let content = fs.readFileSync(file, 'utf8');
        let original = content;

        // Fix ROLES properties
        content = content.replace(/ROLES\.GENERAL_MANAGER/g, "ROLES.GM");
        content = content.replace(/ROLES\.PRINCIPAL/g, "ROLES.DEAN");

        // Fix raw strings
        content = content.replace(/'gm'/g, "'gm'");
        content = content.replace(/'dean'/g, "'dean'");
        content = content.replace(/'gm'/g, "'gm'");
        content = content.replace(/'dean'/g, "'dean'");

        // Deduplicate lists like authorize(ROLES.DEAN)
        content = content.replace(/ROLES\.DEAN,\s*ROLES\.DEAN/g, "ROLES.DEAN");
        content = content.replace(/ROLES\.GM,\s*ROLES\.GM/g, "ROLES.GM");
        content = content.replace(/'dean',\s*'dean'/g, "'dean'");
        content = content.replace(/'gm',\s*'gm'/g, "'gm'");

        // Specifically for User model enum
        if (file.includes('User.js')) {
            content = content.replace(/enum: \['local', 'google'\],/g, "enum: ['local', 'google'],");
        }

        if (content !== original) {
            fs.writeFileSync(file, content, 'utf8');
            console.log('Fixed', file);
        }
    });
});
