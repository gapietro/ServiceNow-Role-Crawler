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
 * Find any record by sys_id and get its name/title
 */
function findRecordBySysId(sysId) {
    if (!sysId || sysId.length !== 32) {
        return null;
    }
    
    try {
        // First, try to find what table this sys_id belongs to using sys_metadata
        var metaGr = new GlideRecord('sys_metadata');
        metaGr.addQuery('sys_id', sysId);
        metaGr.query();
        
        if (metaGr.next()) {
            var tableName = metaGr.getValue('sys_class_name');
            
            if (tableName) {
                // Now query the actual table to get the record details
                var recordGr = new GlideRecord(tableName);
                if (recordGr.get(sysId)) {
                    // Try different common name fields in order of preference
                    var nameFields = [
                        'name', 'title', 'short_description', 'description', 
                        'label', 'action_name', 'column_label', 'display_name',
                        'sys_name', 'number', 'user_name', 'first_name'
                    ];
                    
                    var recordName = null;
                    for (var i = 0; i < nameFields.length; i++) {
                        var fieldValue = recordGr.getValue(nameFields[i]);
                        if (fieldValue && fieldValue.trim() !== '') {
                            recordName = fieldValue;
                            break;
                        }
                    }
                    
                    // If we found a name, return the info
                    if (recordName) {
                        return {
                            table: tableName,
                            name: recordName,
                            displayName: getTableDisplayName(tableName) + ': ' + recordName
                        };
                    } else {
                        return {
                            table: tableName,
                            name: 'Unnamed Record',
                            displayName: getTableDisplayName(tableName) + ': Unnamed Record'
                        };
                    }
                }
            }
        }
        
        // If sys_metadata approach fails, try a few common tables directly
        var commonTables = [
            'sys_ui_action', 'sys_script', 'sys_script_client', 'sys_script_include',
            'sys_ui_page', 'sys_ui_macro', 'sys_report', 'sys_user_role',
            'sys_app_module', 'sys_processor', 'sys_web_service'
        ];
        
        for (var j = 0; j < commonTables.length; j++) {
            try {
                var directGr = new GlideRecord(commonTables[j]);
                if (directGr.get(sysId)) {
                    var name = directGr.getValue('name') || 
                              directGr.getValue('title') || 
                              directGr.getValue('action_name') ||
                              'Unknown';
                    return {
                        table: commonTables[j],
                        name: name,
                        displayName: getTableDisplayName(commonTables[j]) + ': ' + name
                    };
                }
            } catch (e) {
                // Skip tables we don't have access to
                continue;
            }
        }
        
    } catch (e) {
        gs.print('Warning: Error looking up sys_id ' + sysId + ' - ' + e.message);
    }
    
    return null;
}

/**
 * Convert table name to human-readable display name
 */
function getTableDisplayName(tableName) {
    var displayNames = {
        'sys_ui_action': 'UI Action',
        'sys_script': 'Business Rule',
        'sys_script_client': 'Client Script',
        'sys_script_include': 'Script Include',
        'sysauto_script': 'Scheduled Job',
        'sys_processor': 'Processor',
        'sys_web_service': 'Web Service',
        'sys_data_source': 'Import Set',
        'wf_workflow': 'Workflow',
        'sys_ui_page': 'UI Page',
        'sys_ui_macro': 'UI Macro',
        'sys_ui_script': 'UI Script',
        'sys_transform_map': 'Transform Map',
        'sys_report': 'Report',
        'sys_ws_operation': 'Web Service Operation',
        'sys_rest_service': 'REST Service',
        'sys_soap_service': 'SOAP Service',
        'sys_ui_form': 'Form',
        'sys_ui_list': 'List',
        'sys_ui_view': 'View',
        'sys_dictionary': 'Dictionary Entry',
        'sys_choice': 'Choice',
        'sys_ui_policy': 'UI Policy',
        'sys_data_policy2': 'Data Policy',
        'sys_script_fix': 'Fix Script',
        'sys_email': 'Email',
        'sysevent_email_action': 'Email Notification',
        'sys_trigger': 'Trigger',
        'sys_flow': 'Flow',
        'sys_hub_flow': 'Hub Flow',
        'sys_app_module': 'Application Module',
        'sys_user_role': 'Role',
        'sys_user': 'User',
        'sys_user_group': 'Group'
    };
    
    return displayNames[tableName] || tableName.replace(/^sys_/, '').replace(/_/g, ' ').replace(/\b\w/g, function(l) { return l.toUpperCase(); });
}

/**
 * Resolve operation sys_id to human-readable name
 */
function resolveOperationName(operation, tableName) {
    // If operation is not a sys_id (32 characters), return as-is
    if (!operation || operation.length !== 32) {
        return operation;
    }
    
    // Use the comprehensive sys_id lookup
    var recordInfo = findRecordBySysId(operation);
    
    if (recordInfo) {
        return recordInfo.displayName;
    }
    
    // If we still can't resolve it, provide context with the table name
    return 'Unknown Operation: ' + operation.substring(0, 8) + '... (on table: ' + (tableName || 'unknown') + ')';
}

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
                
                // Resolve operation name if it's a sys_id
                var operation = aclGr.getValue('operation');
                var resolvedOperation = resolveOperationName(operation, tableName);
                
                // Resolve table name if it's a sys_id
                var tableDisplay = tableName;
                if (tableName && tableName.length === 32 && !tableName.includes('.')) {
                    // This might be a sys_id, try to resolve it
                    var tableRecord = findRecordBySysId(tableName);
                    if (tableRecord) {
                        tableDisplay = tableRecord.displayName;
                    }
                }
                
                // Resolve type if it's a sys_id
                var aclType = aclGr.getValue('type');
                var typeDisplay = aclType;
                if (aclType && aclType.length === 32) {
                    // This might be a sys_id, try to resolve it
                    var typeRecord = findRecordBySysId(aclType);
                    if (typeRecord) {
                        typeDisplay = typeRecord.displayName;
                    }
                }
                
                roleObj.acls.push({
                    table: tableName, // Keep original for sorting/processing
                    tableDisplay: tableDisplay, // Human-readable version for display
                    operation: operation, // Keep original for sorting
                    operationDisplay: resolvedOperation, // Human-readable version for display
                    type: aclType, // Keep original for sorting
                    typeDisplay: typeDisplay, // Human-readable version for display
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
            var tableKey = acl.table;
            if (!appTables[tableKey]) {
                appTables[tableKey] = {
                    name: acl.table,
                    displayName: acl.tableDisplay || acl.table,
                    roles: []
                };
            }
            if (appTables[tableKey].roles.indexOf(role.name) === -1) {
                appTables[tableKey].roles.push(role.name);
            }
        });
    });
    for (var table in appTables) {
        result.applications.push(appTables[table]);
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

    // Role Hierarchy - Sort by package, then by role name
    html += '<h2>Role Hierarchy (' + profile.allRoles.length + ' roles total)</h2>\n';
    html += '<table>\n<tr><th>Type</th><th>Role Name</th><th>Description</th><th>Package</th></tr>\n';
    
    var sortedRoles = profile.allRoles.slice().sort(function(a, b) {
        // First sort by package
        if (a.packageInfo.name !== b.packageInfo.name) {
            return a.packageInfo.name.localeCompare(b.packageInfo.name);
        }
        // Then by role name
        return a.name.localeCompare(b.name);
    });
    
    sortedRoles.forEach(function(role) {
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

    // ACL Summary by Role - Sort roles by package, then by role name
    html += '<h2>Access Control Lists (ACLs) by Role</h2>\n';
    var totalACLs = 0;
    sortedRoles.forEach(function(role) {
        if (role.acls.length > 0) {
            totalACLs += role.acls.length;
            var roleType = role.isDirect ? 'DIRECT' : 'INHERITED';
            var packageInfo = role.packageInfo.name !== 'Global' ? ' (Package: ' + role.packageInfo.name + ')' : '';
            html += '<h3>' + roleType + ' - ' + role.name + packageInfo + ' (' + role.acls.length + ' ACLs)</h3>\n';
            
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
                // Sort ACLs within each operation by package, then by table name
                aclsByOperation[operation].sort(function(a, b) {
                    if (a.tablePackage.name !== b.tablePackage.name) {
                        return a.tablePackage.name.localeCompare(b.tablePackage.name);
                    }
                    return a.table.localeCompare(b.table);
                });
                
                // Use the display name of the first ACL for the operation header
                var operationDisplayName = aclsByOperation[operation][0].operationDisplay || operation.toUpperCase();
                
                aclsByOperation[operation].forEach(function(acl, index) {
                    html += '<tr>\n';
                    if (index === 0) {
                        html += '<td rowspan="' + aclsByOperation[operation].length + '">' + operationDisplayName + '</td>\n';
                    }
                    html += '<td>' + (acl.tableDisplay || acl.table) + '</td>\n';
                    html += '<td>' + (acl.typeDisplay || acl.type) + '</td>\n';
                    html += '<td class="package">' + acl.tablePackage.name + '</td>\n';
                    html += '</tr>\n';
                });
            }
            html += '</table>\n';
        }
    });

    // Tables/Applications Summary - Sort by package, then by table name
    html += '<h2>Tables/Applications Accessed (' + profile.applications.length + ' total)</h2>\n';
    if (profile.applications.length > 0) {
        // Group by package and sort
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
        
        // Sort packages alphabetically and tables within each package
        var sortedPackages = Object.keys(tablesByPackage).sort();
        
        html += '<table>\n<tr><th>Package</th><th>Table/Application</th><th>Accessed via Roles</th></tr>\n';
        for (var i = 0; i < sortedPackages.length; i++) {
            var pkg = sortedPackages[i];
            // Sort tables within each package
            tablesByPackage[pkg].sort(function(a, b) {
                return (a.displayName || a.name).localeCompare(b.displayName || b.name);
            });
            
            tablesByPackage[pkg].forEach(function(app, index) {
                html += '<tr>\n';
                if (index === 0) {
                    html += '<td rowspan="' + tablesByPackage[pkg].length + '" class="package">' + pkg + '</td>\n';
                }
                html += '<td>' + (app.displayName || app.name) + '</td>\n';
                html += '<td>' + app.roles.join(', ') + '</td>\n';
                html += '</tr>\n';
            });
        }
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
    
    // Package distribution - Sort packages alphabetically
    var packageCounts = {};
    profile.allRoles.forEach(function(role) {
        var pkg = role.packageInfo.name;
        packageCounts[pkg] = (packageCounts[pkg] || 0) + 1;
    });
    html += '<p><strong>Package distribution:</strong></p>\n<ul>\n';
    var sortedPackageNames = Object.keys(packageCounts).sort();
    for (var i = 0; i < sortedPackageNames.length; i++) {
        var pkg = sortedPackageNames[i];
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
    
    // Role hierarchy - Sort by package, then by role name
    csv += 'Role Hierarchy\n';
    csv += 'Type,Role Name,Description,Package\n';
    
    var sortedRoles = profile.allRoles.slice().sort(function(a, b) {
        // First sort by package
        if (a.packageInfo.name !== b.packageInfo.name) {
            return a.packageInfo.name.localeCompare(b.packageInfo.name);
        }
        // Then by role name
        return a.name.localeCompare(b.name);
    });
    
    sortedRoles.forEach(function(role) {
        var roleType = role.isDirect ? 'DIRECT' : 'INHERITED';
        csv += '"' + roleType + '","' + role.name + '","' + (role.description || '').replace(/"/g, '""') + '","' + role.packageInfo.name + '"\n';
    });
    
    csv += '\nACL Details\n';
    csv += 'Role Type,Role Name,Role Package,Table/Field,Table Display,Operation,Operation Display,ACL Type,Type Display,Table Package\n';
    sortedRoles.forEach(function(role) {
        if (role.acls.length > 0) {
            var roleType = role.isDirect ? 'DIRECT' : 'INHERITED';
            
            // Sort ACLs by table package, then by table name
            var sortedAcls = role.acls.slice().sort(function(a, b) {
                if (a.tablePackage.name !== b.tablePackage.name) {
                    return a.tablePackage.name.localeCompare(b.tablePackage.name);
                }
                return a.table.localeCompare(b.table);
            });
            
            sortedAcls.forEach(function(acl) {
                csv += '"' + roleType + '","' + role.name + '","' + role.packageInfo.name + '","' + acl.table + '","' + (acl.tableDisplay || acl.table) + '","' + acl.operation + '","' + (acl.operationDisplay || acl.operation) + '","' + acl.type + '","' + (acl.typeDisplay || acl.type) + '","' + acl.tablePackage.name + '"\n';
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

    // Role Hierarchy - Sort by package, then by role name
    gs.print('▶ ROLE HIERARCHY (' + profile.allRoles.length + ' roles total)');
    var sortedRoles = profile.allRoles.slice().sort(function(a, b) {
        // First sort by package
        if (a.packageInfo.name !== b.packageInfo.name) {
            return a.packageInfo.name.localeCompare(b.packageInfo.name);
        }
        // Then by role name
        return a.name.localeCompare(b.name);
    });
    
    sortedRoles.forEach(function(role) {
        var roleType = role.isDirect ? '[DIRECT]' : '[INHERITED]';
        var packageInfo = role.packageInfo.name !== 'Global' ? ' (Package: ' + role.packageInfo.name + ')' : '';
        gs.print('  ' + roleType + ' ' + role.name + packageInfo);
        if (role.description) {
            gs.print('    Description: ' + role.description);
        }
    });
    gs.print('');

    // ACL Details by Role - Sort roles by package, then by role name
    gs.print('▶ ACCESS CONTROL LISTS (ACLs) BY ROLE');
    var totalACLs = 0;
    sortedRoles.forEach(function(role) {
        if (role.acls.length > 0) {
            totalACLs += role.acls.length;
            var roleType = role.isDirect ? '[DIRECT]' : '[INHERITED]';
            var packageInfo = role.packageInfo.name !== 'Global' ? ' (Package: ' + role.packageInfo.name + ')' : '';
            gs.print('  ' + roleType + ' ' + role.name + packageInfo + ' (' + role.acls.length + ' ACLs):');
            
            // Group ACLs by operation
            var aclsByOperation = {};
            role.acls.forEach(function(acl) {
                if (!aclsByOperation[acl.operation]) {
                    aclsByOperation[acl.operation] = [];
                }
                aclsByOperation[acl.operation].push(acl);
            });
            
            // Display ACLs grouped by operation, sorted by table package then table name
            for (var operation in aclsByOperation) {
                // Sort ACLs within each operation by package, then by table name
                aclsByOperation[operation].sort(function(a, b) {
                    if (a.tablePackage.name !== b.tablePackage.name) {
                        return a.tablePackage.name.localeCompare(b.tablePackage.name);
                    }
                    return a.table.localeCompare(b.table);
                });
                
                // Use the display name of the first ACL for the operation header
                var operationDisplayName = aclsByOperation[operation][0].operationDisplay || operation.toUpperCase();
                gs.print('    ' + operationDisplayName + ' (' + aclsByOperation[operation].length + '):');
                aclsByOperation[operation].forEach(function(acl) {
                    var packageInfo = acl.tablePackage.name !== 'Global' ? ' [' + acl.tablePackage.name + ']' : '';
                    var tableDisplay = acl.tableDisplay || acl.table;
                    var typeDisplay = acl.typeDisplay || acl.type;
                    gs.print('      • ' + tableDisplay + packageInfo + ' (' + typeDisplay + ')');
                });
            }
            gs.print('');
        }
    });

    // Tables/Applications Summary - Sort by package, then by table name
    gs.print('▶ TABLES/APPLICATIONS ACCESSED (' + profile.applications.length + ' total)');
    if (profile.applications.length === 0) {
        gs.print('  No tables/applications found with ACL access.');
    } else {
        // Group by package and sort
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
        
        // Sort packages alphabetically
        var sortedPackages = Object.keys(tablesByPackage).sort();
        
        for (var i = 0; i < sortedPackages.length; i++) {
            var pkg = sortedPackages[i];
            // Sort tables within each package
            tablesByPackage[pkg].sort(function(a, b) {
                return (a.displayName || a.name).localeCompare(b.displayName || b.name);
            });
            
            gs.print('  Package: ' + pkg + ' (' + tablesByPackage[pkg].length + ' tables)');
            tablesByPackage[pkg].forEach(function(app) {
                gs.print('    • ' + (app.displayName || app.name) + ' (via roles: ' + app.roles.join(', ') + ')');
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
    
    // Package distribution - Sort packages alphabetically
    var packageCounts = {};
    profile.allRoles.forEach(function(role) {
        var pkg = role.packageInfo.name;
        packageCounts[pkg] = (packageCounts[pkg] || 0) + 1;
    });
    gs.print('  Package distribution:');
    var sortedPackageNames = Object.keys(packageCounts).sort();
    for (var i = 0; i < sortedPackageNames.length; i++) {
        var pkg = sortedPackageNames[i];
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