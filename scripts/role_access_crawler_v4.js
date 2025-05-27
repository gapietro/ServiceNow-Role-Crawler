/**
 * ServiceNow Role Access Crawler - Based on GroupAccessProfileUtils Pattern
 * Provides comprehensive role access analysis starting from a role name
 * Outputs to console, HTML file, or CSV file
 */

// CONFIGURATION
var roleName = 'adt_user'; // <-- Set the role name here
var outputFormat = 'html'; // Options: 'console', 'html', 'csv', 'all'
var now = new GlideDateTime();
var fileName = 'role_access_report_' + roleName + '_' + now.getNumericValue();

gs.print('=== ServiceNow Role Access Profile Report ===');
gs.print('Role: ' + roleName);
gs.print('Output Format: ' + outputFormat);
gs.print('Generated: ' + new GlideDateTime().getDisplayValue());
gs.print('==============================================\n');

/**
 * Get role access profile by role name
 */
function getRoleAccessProfile(roleName) {
    var result = {
        role: {},
        allRoles: [],
        applications: []
    };

    // 1. Resolve role sys_id
    var roleGr = new GlideRecord('sys_user_role');
    roleGr.addQuery('name', roleName);
    roleGr.query();
    if (!roleGr.next()) {
        result.error = "Role not found: " + roleName;
        return result;
    }
    
    result.role = {
        name: roleGr.getValue('name'),
        sys_id: roleGr.getValue('sys_id'),
        description: roleGr.getValue('description')
    };

    // 2. Get direct and inherited roles
    var directRoles = [roleGr.getValue('sys_id')]; // Start with the main role
    var allRoles = [roleGr.getValue('sys_id')];
    
    // Get inherited roles (child roles)
    var inherited = getChildRoles(roleGr.getValue('sys_id'), {});
    for (var i = 0; i < inherited.length; i++) {
        if (allRoles.indexOf(inherited[i]) === -1) {
            allRoles.push(inherited[i]);
        }
    }

    // 3. Get role details and ACLs for each role
    for (var i = 0; i < allRoles.length; i++) {
        var roleId = allRoles[i];
        var roleDetailGr = new GlideRecord('sys_user_role');
        if (!roleDetailGr.get(roleId)) continue;

        // Get package info for the role
        var pkgObj = { name: 'Global', sys_id: null };
        var pkgId = roleDetailGr.getValue('sys_package');
        if (pkgId) {
            var pkgGr = new GlideRecord('sys_package');
            if (pkgGr.get(pkgId)) {
                pkgObj = { name: pkgGr.getValue('name'), sys_id: pkgId };
            } else {
                pkgObj = { name: 'Unknown', sys_id: pkgId };
            }
        }

        var roleObj = {
            name: roleDetailGr.getValue('name'),
            sys_id: roleId,
            description: roleDetailGr.getValue('description'),
            isDirect: directRoles.indexOf(roleId) !== -1,
            packageInfo: pkgObj,
            acls: []
        };

        // Get ACLs for this role using sys_security_acl_role table
        var aclRoleGr = new GlideRecord('sys_security_acl_role');
        aclRoleGr.addQuery('sys_user_role', roleId);
        aclRoleGr.query();
        var aclIds = [];
        while (aclRoleGr.next()) {
            aclIds.push(aclRoleGr.getValue('sys_security_acl'));
        }

        if (aclIds.length > 0) {
            var aclGr = new GlideRecord('sys_security_acl');
            aclGr.addQuery('sys_id', 'IN', aclIds.join(','));
            aclGr.query();
            while (aclGr.next()) {
                // Get package info for the table (ACL target)
                var tableName = aclGr.getValue('name');
                var tablePkgObj = { name: 'Global', sys_id: null };
                if (tableName) {
                    var dbObjGr = new GlideRecord('sys_db_object');
                    dbObjGr.addQuery('name', tableName.split('.')[0]); // handle field-level ACLs
                    dbObjGr.query();
                    if (dbObjGr.next()) {
                        var tablePkgId = dbObjGr.getValue('sys_package');
                        if (tablePkgId) {
                            var tablePkgGr = new GlideRecord('sys_package');
                            if (tablePkgGr.get(tablePkgId)) {
                                tablePkgObj = { name: tablePkgGr.getValue('name'), sys_id: tablePkgId };
                            } else {
                                tablePkgObj = { name: 'Unknown', sys_id: tablePkgId };
                            }
                        }
                    }
                }
                roleObj.acls.push({
                    table: tableName,
                    operation: aclGr.getValue('operation'),
                    type: aclGr.getValue('type'),
                    description: aclGr.getValue('description'),
                    tablePackage: tablePkgObj
                });
            }
        }
        result.allRoles.push(roleObj);
    }

    // 4. Applications/tables summary
    var appTables = {};
    result.allRoles.forEach(function(role) {
        role.acls.forEach(function(acl) {
            if (!appTables[acl.table]) appTables[acl.table] = [];
            if (appTables[acl.table].indexOf(role.name) === -1) {
                appTables[acl.table].push(role.name);
            }
        });
    });
    for (var table in appTables) {
        result.applications.push({ name: table, roles: appTables[table] });
    }

    return result;
}

/**
 * Recursively get all child roles (inherited roles)
 */
function getChildRoles(parentRoleId, seen) {
    if (seen[parentRoleId]) return [];
    seen[parentRoleId] = true;
    var children = [];
    var containsGr = new GlideRecord('sys_user_role_contains');
    containsGr.addQuery('role', parentRoleId);
    containsGr.query();
    while (containsGr.next()) {
        var childId = containsGr.getValue('contains');
        children.push(childId);
        var grandChildren = getChildRoles(childId, seen);
        for (var i = 0; i < grandChildren.length; i++) {
            if (children.indexOf(grandChildren[i]) === -1) {
                children.push(grandChildren[i]);
            }
        }
    }
    return children;
}

/**
 * Generate HTML report
 */
function generateHTMLReport(profile) {
    if (profile.error) {
        return '<html><body><h1>Error</h1><p>' + profile.error + '</p></body></html>';
    }

    var html = '<!DOCTYPE html>\n<html>\n<head>\n';
    html += '<meta charset="UTF-8">\n';
    html += '<title>ServiceNow Role Access Report - ' + profile.role.name + '</title>\n';
    html += '<style>\n';
    html += 'body { font-family: Arial, sans-serif; margin: 20px; }\n';
    html += 'h1 { color: #2c5aa0; border-bottom: 2px solid #2c5aa0; }\n';
    html += 'h2 { color: #4a4a4a; margin-top: 30px; }\n';
    html += 'h3 { color: #666; }\n';
    html += 'table { border-collapse: collapse; width: 100%; margin: 10px 0; }\n';
    html += 'th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }\n';
    html += 'th { background-color: #f2f2f2; font-weight: bold; }\n';
    html += '.direct { background-color: #e8f5e8; }\n';
    html += '.inherited { background-color: #fff3cd; }\n';
    html += '.summary { background-color: #f8f9fa; padding: 15px; border-radius: 5px; }\n';
    html += '.package { font-style: italic; color: #666; }\n';
    html += '</style>\n';
    html += '</head>\n<body>\n';
    
    html += '<h1>ServiceNow Role Access Profile Report</h1>\n';
    html += '<p><strong>Role:</strong> ' + profile.role.name + '</p>\n';
    html += '<p><strong>Generated:</strong> ' + new GlideDateTime().getDisplayValue() + '</p>\n';
    html += '<p><strong>Description:</strong> ' + (profile.role.description || 'No description') + '</p>\n';
    html += '<p><strong>Sys ID:</strong> ' + profile.role.sys_id + '</p>\n';

    // Role Hierarchy
    html += '<h2>Role Hierarchy (' + profile.allRoles.length + ' roles total)</h2>\n';
    html += '<table>\n<tr><th>Type</th><th>Role Name</th><th>Description</th><th>Package</th></tr>\n';
    profile.allRoles.forEach(function(role) {
        var roleType = role.isDirect ? 'DIRECT' : 'INHERITED';
        var cssClass = role.isDirect ? 'direct' : 'inherited';
        html += '<tr class="' + cssClass + '">\n';
        html += '<td>' + roleType + '</td>\n';
        html += '<td>' + role.name + '</td>\n';
        html += '<td>' + (role.description || '') + '</td>\n';
        html += '<td class="package">' + role.packageInfo.name + '</td>\n';
        html += '</tr>\n';
    });
    html += '</table>\n';

    // ACL Summary by Role
    html += '<h2>Access Control Lists (ACLs) by Role</h2>\n';
    var totalACLs = 0;
    profile.allRoles.forEach(function(role) {
        if (role.acls.length > 0) {
            totalACLs += role.acls.length;
            var roleType = role.isDirect ? 'DIRECT' : 'INHERITED';
            html += '<h3>' + roleType + ' - ' + role.name + ' (' + role.acls.length + ' ACLs)</h3>\n';
            
            // Group ACLs by operation
            var aclsByOperation = {};
            role.acls.forEach(function(acl) {
                if (!aclsByOperation[acl.operation]) {
                    aclsByOperation[acl.operation] = [];
                }
                aclsByOperation[acl.operation].push(acl);
            });
            
            html += '<table>\n<tr><th>Operation</th><th>Table/Field</th><th>Type</th><th>Package</th></tr>\n';
            for (var operation in aclsByOperation) {
                aclsByOperation[operation].forEach(function(acl, index) {
                    html += '<tr>\n';
                    if (index === 0) {
                        html += '<td rowspan="' + aclsByOperation[operation].length + '">' + operation.toUpperCase() + '</td>\n';
                    }
                    html += '<td>' + acl.table + '</td>\n';
                    html += '<td>' + acl.type + '</td>\n';
                    html += '<td class="package">' + acl.tablePackage.name + '</td>\n';
                    html += '</tr>\n';
                });
            }
            html += '</table>\n';
        }
    });

    // Tables/Applications Summary
    html += '<h2>Tables/Applications Accessed (' + profile.applications.length + ' total)</h2>\n';
    if (profile.applications.length > 0) {
        html += '<table>\n<tr><th>Table/Application</th><th>Accessed via Roles</th></tr>\n';
        profile.applications.forEach(function(app) {
            html += '<tr>\n';
            html += '<td>' + app.name + '</td>\n';
            html += '<td>' + app.roles.join(', ') + '</td>\n';
            html += '</tr>\n';
        });
        html += '</table>\n';
    }

    // Summary Statistics
    html += '<h2>Summary Statistics</h2>\n';
    html += '<div class="summary">\n';
    html += '<p><strong>Total roles in hierarchy:</strong> ' + profile.allRoles.length + '</p>\n';
    html += '<p><strong>Direct roles:</strong> ' + profile.allRoles.filter(function(r) { return r.isDirect; }).length + '</p>\n';
    html += '<p><strong>Inherited roles:</strong> ' + profile.allRoles.filter(function(r) { return !r.isDirect; }).length + '</p>\n';
    html += '<p><strong>Total ACLs:</strong> ' + totalACLs + '</p>\n';
    html += '<p><strong>Tables/Applications accessed:</strong> ' + profile.applications.length + '</p>\n';
    
    // Package distribution
    var packageCounts = {};
    profile.allRoles.forEach(function(role) {
        var pkg = role.packageInfo.name;
        packageCounts[pkg] = (packageCounts[pkg] || 0) + 1;
    });
    html += '<p><strong>Package distribution:</strong></p>\n<ul>\n';
    for (var pkg in packageCounts) {
        html += '<li>' + pkg + ': ' + packageCounts[pkg] + ' roles</li>\n';
    }
    html += '</ul>\n';
    html += '</div>\n';
    
    html += '</body>\n</html>';
    return html;
}

/**
 * Generate CSV report
 */
function generateCSVReport(profile) {
    if (profile.error) {
        return 'Error,' + profile.error;
    }

    var csv = 'Role Access Report - ' + profile.role.name + '\n';
    csv += 'Generated,' + new GlideDateTime().getDisplayValue() + '\n\n';
    
    // Role hierarchy
    csv += 'Role Hierarchy\n';
    csv += 'Type,Role Name,Description,Package\n';
    profile.allRoles.forEach(function(role) {
        var roleType = role.isDirect ? 'DIRECT' : 'INHERITED';
        csv += '"' + roleType + '","' + role.name + '","' + (role.description || '').replace(/"/g, '""') + '","' + role.packageInfo.name + '"\n';
    });
    
    csv += '\nACL Details\n';
    csv += 'Role Type,Role Name,Table/Field,Operation,ACL Type,Package\n';
    profile.allRoles.forEach(function(role) {
        if (role.acls.length > 0) {
            var roleType = role.isDirect ? 'DIRECT' : 'INHERITED';
            role.acls.forEach(function(acl) {
                csv += '"' + roleType + '","' + role.name + '","' + acl.table + '","' + acl.operation + '","' + acl.type + '","' + acl.tablePackage.name + '"\n';
            });
        }
    });
    
    return csv;
}

/**
 * Generate console report
 */
function generateConsoleReport(profile) {
    if (profile.error) {
        gs.print('ERROR: ' + profile.error);
        return;
    }

    // Role Information
    gs.print('▶ ROLE INFORMATION');
    gs.print('  Name: ' + profile.role.name);
    gs.print('  Description: ' + (profile.role.description || 'No description'));
    gs.print('  Sys ID: ' + profile.role.sys_id);
    gs.print('');

    // Role Hierarchy
    gs.print('▶ ROLE HIERARCHY (' + profile.allRoles.length + ' roles total)');
    profile.allRoles.forEach(function(role) {
        var roleType = role.isDirect ? '[DIRECT]' : '[INHERITED]';
        var packageInfo = role.packageInfo.name !== 'Global' ? ' (Package: ' + role.packageInfo.name + ')' : '';
        gs.print('  ' + roleType + ' ' + role.name + packageInfo);
        if (role.description) {
            gs.print('    Description: ' + role.description);
        }
    });
    gs.print('');

    // ACL Details by Role
    gs.print('▶ ACCESS CONTROL LISTS (ACLs) BY ROLE');
    var totalACLs = 0;
    profile.allRoles.forEach(function(role) {
        if (role.acls.length > 0) {
            totalACLs += role.acls.length;
            var roleType = role.isDirect ? '[DIRECT]' : '[INHERITED]';
            gs.print('  ' + roleType + ' ' + role.name + ' (' + role.acls.length + ' ACLs):');
            
            // Group ACLs by operation
            var aclsByOperation = {};
            role.acls.forEach(function(acl) {
                if (!aclsByOperation[acl.operation]) {
                    aclsByOperation[acl.operation] = [];
                }
                aclsByOperation[acl.operation].push(acl);
            });
            
            // Display ACLs grouped by operation
            for (var operation in aclsByOperation) {
                gs.print('    ' + operation.toUpperCase() + ' (' + aclsByOperation[operation].length + '):');
                aclsByOperation[operation].forEach(function(acl) {
                    var packageInfo = acl.tablePackage.name !== 'Global' ? ' [' + acl.tablePackage.name + ']' : '';
                    gs.print('      • ' + acl.table + packageInfo + ' (' + acl.type + ')');
                });
            }
            gs.print('');
        }
    });

    // Tables/Applications Summary
    gs.print('▶ TABLES/APPLICATIONS ACCESSED (' + profile.applications.length + ' total)');
    if (profile.applications.length === 0) {
        gs.print('  No tables/applications found with ACL access.');
    } else {
        // Group by package
        var tablesByPackage = {};
        profile.applications.forEach(function(app) {
            // Find package for this table
            var packageName = 'Global';
            profile.allRoles.forEach(function(role) {
                role.acls.forEach(function(acl) {
                    if (acl.table === app.name && acl.tablePackage.name !== 'Global') {
                        packageName = acl.tablePackage.name;
                    }
                });
            });
            
            if (!tablesByPackage[packageName]) {
                tablesByPackage[packageName] = [];
            }
            tablesByPackage[packageName].push(app);
        });
        
        for (var pkg in tablesByPackage) {
            gs.print('  Package: ' + pkg + ' (' + tablesByPackage[pkg].length + ' tables)');
            tablesByPackage[pkg].forEach(function(app) {
                gs.print('    • ' + app.name + ' (via roles: ' + app.roles.join(', ') + ')');
            });
            gs.print('');
        }
    }

    // Summary Statistics
    gs.print('▶ SUMMARY STATISTICS');
    gs.print('  Total roles in hierarchy: ' + profile.allRoles.length);
    gs.print('  Direct roles: ' + profile.allRoles.filter(function(r) { return r.isDirect; }).length);
    gs.print('  Inherited roles: ' + profile.allRoles.filter(function(r) { return !r.isDirect; }).length);
    gs.print('  Total ACLs: ' + totalACLs);
    gs.print('  Tables/Applications accessed: ' + profile.applications.length);
    
    // Package distribution
    var packageCounts = {};
    profile.allRoles.forEach(function(role) {
        var pkg = role.packageInfo.name;
        packageCounts[pkg] = (packageCounts[pkg] || 0) + 1;
    });
    gs.print('  Package distribution:');
    for (var pkg in packageCounts) {
        gs.print('    • ' + pkg + ': ' + packageCounts[pkg] + ' roles');
    }
    
    gs.print('');
    gs.print('=== END OF ROLE ACCESS PROFILE REPORT ===');
}

/**
 * Create file attachment
 */
function createFileAttachment(content, fileName, contentType) {
    try {
        // Create a temporary record to attach the file to (using sys_user table)
        var userGr = new GlideRecord('sys_user');
        userGr.addQuery('user_name', gs.getUserName());
        userGr.query();
        if (!userGr.next()) {
            gs.print('ERROR: Could not find current user for file attachment');
            return null;
        }

        // Create attachment
        var attachment = new GlideSysAttachment();
        var attachmentId = attachment.write(userGr, fileName, contentType, content);
        
        if (attachmentId) {
            // Get the instance URL
            var instanceUrl = gs.getProperty('glide.servlet.uri');
            if (!instanceUrl.startsWith('http')) {
                instanceUrl = 'https://' + gs.getProperty('instance_name') + '.service-now.com';
            }
            
            gs.print('✓ File created successfully!');
            gs.print('  File Name: ' + fileName);
            gs.print('  Attachment ID: ' + attachmentId);
            gs.print('  Attached to user: ' + gs.getUserName());
            gs.print('  You can find this file in your user record attachments.');
            gs.print('  Direct link: ' + instanceUrl + '/sys_attachment.do?sys_id=' + attachmentId);
            gs.print('  Download link: ' + instanceUrl + '/sys_attachment.do?sys_id=' + attachmentId + '&sysparm_referring_url=tear_off');
            return attachmentId;
        } else {
            gs.print('ERROR: Failed to create file attachment');
            return null;
        }
    } catch (e) {
        gs.print('ERROR creating file: ' + e.message);
        return null;
    }
}

// MAIN EXECUTION
var profile = getRoleAccessProfile(roleName);

if (outputFormat === 'console' || outputFormat === 'all') {
    generateConsoleReport(profile);
}

if (outputFormat === 'html' || outputFormat === 'all') {
    var htmlContent = generateHTMLReport(profile);
    var htmlFileName = fileName + '.html';
    createFileAttachment(htmlContent, htmlFileName, 'text/html');
}

if (outputFormat === 'csv' || outputFormat === 'all') {
    var csvContent = generateCSVReport(profile);
    var csvFileName = fileName + '.csv';
    createFileAttachment(csvContent, csvFileName, 'text/csv');
}

gs.print('\n=== SCRIPT EXECUTION COMPLETED ==='); 