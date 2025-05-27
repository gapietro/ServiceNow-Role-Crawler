# ServiceNow Role Access Crawler

## Project Overview
This project provides a comprehensive script for ServiceNow administrators to analyze and report on the access provided by a specific ServiceNow role. The script is designed to be run as a Background Script within ServiceNow, taking a role name as input and outputting a detailed, formatted summary of all access granted by that role.

## Key Features
- **Multiple Output Formats:** Console display, HTML file generation, and CSV export
- **File Attachments:** Automatically creates downloadable files attached to your user record
- **Full Instance URLs:** Provides complete links for easy file access and sharing
- **Comprehensive Role Analysis:** Direct and inherited role permissions
- **Professional Reporting:** Styled HTML reports ready for email distribution
- **Data Export:** CSV format for analysis in Excel or other tools

## Installation & Setup

### Prerequisites Check
Before starting, ensure you have:
- [ ] **Admin or elevated privileges** in your ServiceNow instance
- [ ] Access to the **System Definition** application menu
- [ ] Permission to run **Background Scripts**
- [ ] Read access to system tables (most admin roles have this)

### Step-by-Step Installation

#### Step 1: Access Background Scripts
1. **Log into your ServiceNow instance** (e.g., `https://yourinstance.service-now.com`)
2. **Navigate to Background Scripts:**
   - In the **Application Navigator** (left sidebar), type: `Scripts - Background`
   - Click on **System Definition > Scripts - Background**
   - OR use the direct URL: `https://yourinstance.service-now.com/nav_to.do?uri=sys_script_background.do`

#### Step 2: Open the Script Editor
1. **You should see the Background Scripts interface** with:
   - A large text area for script input
   - A "Run script" button at the bottom
   - Various options and settings
2. **Clear any existing content** in the script text area (if present)

#### Step 3: Copy the Script
1. **Navigate to this project's script file:**
   - Go to the `scripts/` folder in this repository
   - Open `role_access_crawler_v4.js`
2. **Copy the entire script content:**
   - Select all text (Ctrl+A or Cmd+A)
   - Copy (Ctrl+C or Cmd+C)
3. **Paste into ServiceNow:**
   - Click in the Background Scripts text area
   - Paste the script (Ctrl+V or Cmd+V)

#### Step 4: Configure the Script
1. **Find the configuration section** at the top of the script (around lines 8-10):
   ```javascript
   // CONFIGURATION
   var roleName = 'adt_user'; // <-- Set the role name here
   var outputFormat = 'html'; // Options: 'console', 'html', 'csv', 'all'
   ```

2. **Set the role name:**
   - Replace `'adt_user'` with the role you want to analyze
   - **Example:** `var roleName = 'itil';`
   - **Important:** Use the exact role name as it appears in ServiceNow (case-sensitive)

3. **Choose output format:**
   - `'console'` - Display results in the script output area
   - `'html'` - Generate a professional HTML report file
   - `'csv'` - Generate a CSV file for Excel analysis
   - `'all'` - Generate both HTML and CSV files plus console output

#### Step 5: Run the Script
1. **Click the "Run script" button** at the bottom of the page
2. **Wait for execution** (may take 30 seconds to several minutes depending on role complexity)
3. **Check for errors** in the output area:
   - Green text = success messages
   - Red text = errors (see troubleshooting section)

#### Step 6: Access Your Reports
1. **For Console Output:**
   - Results appear directly in the output area below the script
   - Scroll through to see the complete report

2. **For File Outputs (HTML/CSV):**
   - Look for success messages like:
     ```
     ✓ File created successfully!
       File Name: role_access_report_itil_20240115143025000.html
       Direct link: https://yourinstance.service-now.com/sys_attachment.do?sys_id=abc123
       Download link: https://yourinstance.service-now.com/sys_attachment.do?sys_id=abc123&sysparm_referring_url=tear_off
     ```
   - **Click the "Download link"** to immediately download the file
   - **Or click the "Direct link"** to view the file details in ServiceNow

### Quick Start Example

Here's a complete example for analyzing the 'itil' role:

1. **Copy this configuration:**
   ```javascript
   var roleName = 'itil';
   var outputFormat = 'html';
   ```

2. **Paste the full script** into Background Scripts
3. **Update the configuration** with the above values
4. **Click "Run script"**
5. **Wait for completion** and click the download link

### Common Mistakes to Avoid

#### ❌ **Wrong Role Name**
- **Problem:** `Role not found: ITIL`
- **Solution:** Use exact case: `'itil'` not `'ITIL'`
- **How to check:** Go to User Administration > Roles to see exact names

#### ❌ **Missing Quotes**
- **Problem:** `var roleName = itil;` (missing quotes)
- **Solution:** `var roleName = 'itil';` (with quotes)

#### ❌ **Wrong Navigation**
- **Problem:** Can't find Background Scripts
- **Solution:** Type "background" in the Application Navigator filter

#### ❌ **Permission Issues**
- **Problem:** "Access denied" or "Table not found"
- **Solution:** Contact your ServiceNow admin for elevated permissions

#### ❌ **Script Timeout**
- **Problem:** Script stops running after a few minutes
- **Solution:** Try with a simpler role first, or use CSV format for large roles

### Verification Steps

After running the script, verify success by checking:

1. **Console Output Shows:**
   ```
   === ServiceNow Role Access Profile Report ===
   Role: your_role_name
   Output Format: html
   Generated: 2024-01-15 14:30:25
   ==============================================
   ```

2. **No Error Messages** (red text in output)

3. **File Creation Messages** (if using HTML/CSV output):
   ```
   ✓ File created successfully!
   ```

4. **Clickable Links** provided in the output

### Getting Help

If you encounter issues:

1. **Check the Troubleshooting section** below
2. **Verify your role name** in User Administration > Roles
3. **Try with a simple role first** (like 'admin' or 'itil')
4. **Use console output** to test before generating files
5. **Contact your ServiceNow administrator** for permission issues

---

## What the Script Analyzes
- **Direct Role Permissions:** Access explicitly granted to the specified role
- **Inherited Role Access:** Permissions from all roles in the hierarchy (child roles)
- **Access Control Lists (ACLs):** Table and field-level security controls
- **Role Hierarchy:** Complete role inheritance chain with package information
- **Package Distribution:** Shows which ServiceNow packages contain the roles and tables

## Output Format Options

### Configuration
Set these variables at the top of the script:
```javascript
var roleName = 'adt_user'; // <-- Set the role name here
var outputFormat = 'html'; // Options: 'console', 'html', 'csv', 'all'
```

### Available Output Formats

#### 1. Console Output (`outputFormat = 'console'`)
- Displays results directly in the Background Script console
- Organized sections with clear headings
- Perfect for quick analysis and debugging

#### 2. HTML Report (`outputFormat = 'html'`)
- Professional styled report with ServiceNow branding
- Color-coded direct vs inherited roles
- Responsive tables with proper formatting
- Ready for email distribution or PDF conversion
- Includes summary statistics and package information

#### 3. CSV Export (`outputFormat = 'csv'`)
- Structured data format for Excel analysis
- Separate sections for role hierarchy and ACL details
- Properly escaped CSV format
- Great for data manipulation and reporting

#### 4. All Formats (`outputFormat = 'all'`)
- Generates console output plus both HTML and CSV files
- Comprehensive reporting for all use cases

## File Attachment Features

### Automatic File Creation
When using HTML or CSV output formats, the script automatically:
- Creates files with timestamped names (e.g., `role_access_report_adt_user_20240115143025000.html`)
- Attaches files to your ServiceNow user record
- Provides full instance URLs for immediate access

### File Access Information
The script outputs complete access information:
```
✓ File created successfully!
  File Name: role_access_report_adt_user_20240115143025000.html
  Attachment ID: abc123def456
  Attached to user: your.username
  You can find this file in your user record attachments.
  Direct link: https://yourinstance.service-now.com/sys_attachment.do?sys_id=abc123def456
  Download link: https://yourinstance.service-now.com/sys_attachment.do?sys_id=abc123def456&sysparm_referring_url=tear_off
```

### Finding Your Files
1. **Use the provided direct links** - Copy and paste the URLs from the script output
2. **Navigate to your user record** - Go to User Administration > Users, find your record, and check the Attachments tab
3. **Use the download link** - Forces immediate file download to your computer

## Report Contents

### Role Information Section
- Role name, description, and system ID
- Generation timestamp

### Role Hierarchy Section
- Complete list of direct and inherited roles
- Color-coded distinction between direct and inherited access
- Package information for each role
- Role descriptions where available

### Access Control Lists (ACLs) Section
- Organized by role (direct vs inherited)
- Grouped by operation type (READ, WRITE, CREATE, DELETE, etc.)
- Table/field names with package information
- ACL types and descriptions

### Tables/Applications Summary
- Complete list of accessible tables and applications
- Shows which roles provide access to each table
- Grouped by ServiceNow package

### Summary Statistics
- Total roles in hierarchy (direct vs inherited)
- Total number of ACLs
- Number of accessible tables/applications
- Package distribution breakdown

## Usage Instructions

### Basic Usage
1. Navigate to **System Definition > Scripts - Background** in ServiceNow
2. Copy the script from `scripts/role_access_crawler_v4.js`
3. Paste into the Background Script editor
4. Configure the variables at the top:
   ```javascript
   var roleName = 'your_role_name'; // Replace with target role
   var outputFormat = 'html'; // Choose your preferred format
   ```
5. Click **Run script**
6. Review console output and use provided links to access generated files

### Advanced Configuration
- **For quick analysis:** Use `outputFormat = 'console'`
- **For professional reports:** Use `outputFormat = 'html'`
- **For data analysis:** Use `outputFormat = 'csv'`
- **For comprehensive documentation:** Use `outputFormat = 'all'`

## Technical Implementation

### Accurate Role Resolution
- Uses the `sys_security_acl_role` table for precise role-to-ACL relationships
- Avoids false positives from null role fields in ACL records
- Implements recursive role hierarchy traversal
- Handles complex role inheritance chains

### Performance Optimizations
- Batch queries for efficient data retrieval
- Proper query limits to prevent timeouts
- Optimized role hierarchy resolution
- Error handling for large datasets

### File Generation
- Uses ServiceNow's `GlideSysAttachment` API
- Generates clean, timestamped filenames
- Provides multiple access methods (view vs download)
- Includes full instance URLs for easy sharing

## Requirements & Prerequisites

### ServiceNow Access
- **Admin Access:** Background Scripts module access required
- **Table Permissions:** Read access to system tables:
  - `sys_user_role` (roles)
  - `sys_security_acl_role` (role-ACL relationships)
  - `sys_security_acl` (access control lists)
  - `sys_user_role_contains` (role hierarchy)
  - `sys_db_object` (table definitions)
  - `sys_package` (package information)

### Performance Considerations
- **Large Role Hierarchies:** May take several minutes for complex roles
- **Memory Usage:** HTML generation requires sufficient memory for large reports
- **File Size:** CSV exports can be large for roles with many ACLs

### Browser Compatibility
- **HTML Reports:** Compatible with all modern browsers
- **File Downloads:** Supports all browsers with standard download capabilities
- **CSV Files:** Open in Excel, Google Sheets, or any CSV-compatible application

## Troubleshooting

### Common Issues
1. **Role Not Found:** Verify the role name exists and is spelled correctly
2. **Permission Errors:** Ensure your user has read access to required system tables
3. **File Access Issues:** Check that attachments are enabled for your user record
4. **Large Reports:** For roles with extensive access, consider using CSV format for better performance

### Error Messages
- **"Role not found":** The specified role name doesn't exist in the system
- **"Could not find current user":** User record lookup failed (rare)
- **"Failed to create file attachment":** Attachment creation permissions issue

## Version History

### v4 (Current)
- Added multiple output format support (console, HTML, CSV)
- Implemented file attachment creation with full URLs
- Enhanced HTML reporting with professional styling
- Added CSV export for data analysis
- Improved error handling and user feedback
- Added comprehensive package information

### Previous Versions
- v3: Diagnostic and debugging enhancements
- v2: Simplified query logic
- v1: Initial implementation with basic console output

## Best Practices

### For Auditing and Compliance
- Use HTML format for formal documentation
- Include generation timestamps in reports
- Save reports with descriptive filenames
- Share download links for easy access

### For Data Analysis
- Use CSV format for Excel analysis
- Export multiple roles for comparison
- Analyze package distribution patterns
- Track role hierarchy complexity

### For Team Collaboration
- Use 'all' format for comprehensive documentation
- Share direct links via email
- Include role descriptions in reports
- Document role inheritance patterns

---

**Note:** This script provides a comprehensive analysis of ServiceNow role access using the proper `sys_security_acl_role` relationship table, ensuring accurate results for security auditing and compliance reporting.