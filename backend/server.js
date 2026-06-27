const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const fs = require('fs/promises');
const path = require('path');
const dotenv = require('dotenv');
const { parseDesktopFile, stringifyDesktopFile } = require('./desktopParser');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'entry_editor_db'
};

let pool;

const iconsDir = process.env.ICONS_DIR || path.join(__dirname, '../icons');
const iconMap = new Map();

async function buildIconIndex(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await buildIconIndex(fullPath);
      } else if (entry.isFile() || entry.isSymbolicLink()) {
        const ext = path.extname(entry.name);
        const baseName = path.basename(entry.name, ext).toLowerCase();
        if (!iconMap.has(baseName) || ext === '.svg') {
          iconMap.set(baseName, fullPath);
        }
      }
    }
  } catch (error) {
    console.error('Error building icon index:', error.message);
  }
}

// Auto-bootstrap and connect database
async function bootstrapDatabase() {
  try {
    console.log('Connecting to MySQL host...');
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password
    });
    
    console.log(`Checking/creating database: ${dbConfig.database}`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``);
    await connection.end();
    
    pool = mysql.createPool(dbConfig);
    
    // Create table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`desktop_entries\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`filename\` VARCHAR(255) NOT NULL UNIQUE,
        \`name\` VARCHAR(255) NOT NULL,
        \`generic_name\` VARCHAR(255) DEFAULT NULL,
        \`exec_cmd\` VARCHAR(512) NOT NULL,
        \`icon\` VARCHAR(255) DEFAULT NULL,
        \`comment\` TEXT DEFAULT NULL,
        \`type\` VARCHAR(50) DEFAULT 'Application',
        \`terminal\` TINYINT(1) DEFAULT 0,
        \`categories\` VARCHAR(512) DEFAULT NULL,
        \`startup_notify\` TINYINT(1) DEFAULT 0,
        \`path_dir\` VARCHAR(512) DEFAULT NULL,
        \`mime_type\` TEXT DEFAULT NULL,
        \`unsupported_fields\` TEXT DEFAULT NULL,
        \`other_sections\` TEXT DEFAULT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    
    // Ensure existing tables are updated to TEXT for mime_type
    try {
      await pool.query('ALTER TABLE `desktop_entries` MODIFY COLUMN `mime_type` TEXT DEFAULT NULL');
    } catch (alterError) {
      console.warn('Unable to alter mime_type column:', alterError.message);
    }
    
    console.log('Database schema validated.');
    
    // Build the icon index
    console.log('Indexing icon theme...');
    await buildIconIndex(iconsDir);
    console.log(`Indexed ${iconMap.size} unique icons.`);
    
    // Sync files from applications/ directory into DB on startup
    await syncFilesToDatabase();
  } catch (error) {
    console.error('Database bootstrap failed. Retrying in 5 seconds...', error.message);
    // Setup pool anyway so app can fail requests properly or reconnect
    pool = mysql.createPool(dbConfig);
    
    // Retry bootstrapping once after 5s
    setTimeout(bootstrapDatabase, 5000);
  }
}

async function syncFilesToDatabase() {
  console.log('Synchronizing desktop files to database...');
  const appsDir = process.env.APPLICATIONS_DIR || path.join(__dirname, '../applications');
  
  try {
    await fs.mkdir(appsDir, { recursive: true });
    const files = await fs.readdir(appsDir);
    const desktopFiles = files.filter(f => f.endsWith('.desktop'));
    
    const processedFilenames = new Set();
    
    for (const filename of desktopFiles) {
      try {
        const filePath = path.join(appsDir, filename);
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = parseDesktopFile(content);
        
        const [rows] = await pool.query('SELECT id FROM desktop_entries WHERE filename = ?', [filename]);
        
        const entryData = [
          filename,
          parsed.name || filename.replace('.desktop', ''),
          parsed.genericName || null,
          parsed.exec || '',
          parsed.icon || null,
          parsed.comment || null,
          parsed.type || 'Application',
          parsed.terminal ? 1 : 0,
          parsed.categories || null,
          parsed.startupNotify ? 1 : 0,
          parsed.path || null,
          parsed.mimeType || null,
          JSON.stringify(parsed.unsupportedFields || {}),
          JSON.stringify(parsed.otherSections || [])
        ];
        
        if (rows.length > 0) {
          await pool.query(`
            UPDATE desktop_entries 
            SET name = ?, generic_name = ?, exec_cmd = ?, icon = ?, comment = ?, 
                type = ?, terminal = ?, categories = ?, startup_notify = ?, 
                path_dir = ?, mime_type = ?, unsupported_fields = ?, other_sections = ?
            WHERE filename = ?
          `, [
            entryData[1], entryData[2], entryData[3], entryData[4], entryData[5],
            entryData[6], entryData[7], entryData[8], entryData[9], entryData[10],
            entryData[11], entryData[12], entryData[13], filename
          ]);
        } else {
          await pool.query(`
            INSERT INTO desktop_entries (
              filename, name, generic_name, exec_cmd, icon, comment, 
              type, terminal, categories, startup_notify, path_dir, mime_type, 
              unsupported_fields, other_sections
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, entryData);
        }
        processedFilenames.add(filename);
      } catch (fileErr) {
        console.error(`Error parsing desktop file ${filename}:`, fileErr.message);
      }
    }
    
    // Remove database rows for files that no longer exist
    const [allDbEntries] = await pool.query('SELECT filename FROM desktop_entries');
    for (const dbEntry of allDbEntries) {
      if (!processedFilenames.has(dbEntry.filename)) {
        console.log(`Removing non-existent file from DB: ${dbEntry.filename}`);
        await pool.query('DELETE FROM desktop_entries WHERE filename = ?', [dbEntry.filename]);
      }
    }
    
    console.log(`Sync complete. Loaded ${processedFilenames.size} files.`);
  } catch (error) {
    console.error('File sync failed:', error.message);
  }
}

// REST Endpoints

// GET /api/icons/search - Search indexed icons
app.get('/api/icons/search', (req, res) => {
  try {
    const query = (req.query.q || '').toLowerCase();
    const limit = parseInt(req.query.limit) || 60;
    
    const matches = [];
    for (const name of iconMap.keys()) {
      if (name.includes(query)) {
        matches.push(name);
        if (matches.length >= limit) break;
      }
    }
    
    res.json(matches);
  } catch (error) {
    console.error('Error searching icons:', error);
    res.status(500).json({ error: 'Failed to search icons' });
  }
});

// GET /api/icons/:name - Serve custom desktop icons from the theme or system path
app.get('/api/icons/:name', async (req, res) => {
  try {
    let iconName = req.params.name;
    if (!iconName) {
      return res.status(400).json({ error: 'Icon name is required' });
    }

    iconName = decodeURIComponent(iconName);

    // If it's an absolute path, try to serve it directly
    if (path.isAbsolute(iconName)) {
      try {
        await fs.access(iconName);
        return res.sendFile(iconName);
      } catch (e) {
        // Fall back to filename extraction
        iconName = path.basename(iconName);
      }
    }

    // Strip extension if any (e.g. icon.png -> icon)
    const ext = path.extname(iconName);
    let baseName = iconName;
    if (ext && ['.png', '.svg', '.jpg', '.jpeg', '.xpm', '.gif'].includes(ext.toLowerCase())) {
      baseName = path.basename(iconName, ext);
    }
    
    const lowercaseName = baseName.toLowerCase();
    const iconPath = iconMap.get(lowercaseName);

    if (iconPath) {
      return res.sendFile(iconPath);
    }

    return res.status(404).json({ error: 'Icon not found' });
  } catch (error) {
    console.error('Error serving icon:', error);
    res.status(500).json({ error: 'Internal server error serving icon' });
  }
});

// GET /api/entries - List with search, category filtering, and pagination
app.get('/api/entries', async (req, res) => {
  try {
    const search = req.query.search || '';
    const category = req.query.category || '';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    let countQuery = 'SELECT COUNT(*) as count FROM desktop_entries WHERE 1=1';
    let selectQuery = 'SELECT * FROM desktop_entries WHERE 1=1';
    const params = [];
    
    if (search) {
      const searchWild = `%${search}%`;
      countQuery += ' AND (name LIKE ? OR generic_name LIKE ? OR exec_cmd LIKE ? OR comment LIKE ?)';
      selectQuery += ' AND (name LIKE ? OR generic_name LIKE ? OR exec_cmd LIKE ? OR comment LIKE ?)';
      params.push(searchWild, searchWild, searchWild, searchWild);
    }
    
    if (category) {
      countQuery += ' AND categories LIKE ?';
      selectQuery += ' AND categories LIKE ?';
      params.push(`%${category}%`);
    }
    
    const [countRows] = await pool.query(countQuery, params);
    const total = countRows[0].count;
    
    selectQuery += ' ORDER BY name ASC LIMIT ? OFFSET ?';
    const selectParams = [...params, limit, offset];
    const [rows] = await pool.query(selectQuery, selectParams);
    
    res.json({
      entries: rows.map(r => ({
        ...r,
        unsupported_fields: JSON.parse(r.unsupported_fields || '{}'),
        other_sections: JSON.parse(r.other_sections || '[]')
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching entries:', error);
    res.status(500).json({ error: 'Failed to fetch desktop entries. Is MySQL running?' });
  }
});

// GET /api/entries/:id - View details
app.get('/api/entries/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM desktop_entries WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    const row = rows[0];
    res.json({
      ...row,
      unsupported_fields: JSON.parse(row.unsupported_fields || '{}'),
      other_sections: JSON.parse(row.other_sections || '[]')
    });
  } catch (error) {
    console.error('Error fetching entry:', error);
    res.status(500).json({ error: 'Failed to fetch desktop entry' });
  }
});

// POST /api/entries - Create a new entry
app.post('/api/entries', async (req, res) => {
  try {
    const {
      name, generic_name, exec_cmd, icon, comment, type,
      terminal, categories, startup_notify, path_dir, mime_type,
      unsupported_fields, other_sections
    } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!exec_cmd || !exec_cmd.trim()) {
      return res.status(400).json({ error: 'Exec command is required' });
    }
    
    let filename = req.body.filename;
    if (!filename || !filename.trim()) {
      filename = name.trim().replace(/[^a-zA-Z0-9]/g, '_') + '.desktop';
    } else if (!filename.endsWith('.desktop')) {
      filename = filename.trim() + '.desktop';
    }
    
    const [exists] = await pool.query('SELECT id FROM desktop_entries WHERE filename = ?', [filename]);
    if (exists.length > 0) {
      return res.status(400).json({ error: `A desktop file named "${filename}" already exists.` });
    }
    
    const desktopData = {
      name,
      genericName: generic_name,
      exec: exec_cmd,
      icon,
      comment,
      type: type || 'Application',
      terminal: !!terminal,
      categories,
      startupNotify: !!startup_notify,
      path: path_dir,
      mimeType: mime_type,
      unsupportedFields: unsupported_fields || {},
      otherSections: other_sections || []
    };
    
    const content = stringifyDesktopFile(desktopData);
    const appsDir = process.env.APPLICATIONS_DIR || path.join(__dirname, '../applications');
    const filePath = path.join(appsDir, filename);
    
    await fs.writeFile(filePath, content, 'utf-8');
    
    const [result] = await pool.query(`
      INSERT INTO desktop_entries (
        filename, name, generic_name, exec_cmd, icon, comment, 
        type, terminal, categories, startup_notify, path_dir, mime_type, 
        unsupported_fields, other_sections
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      filename, name, generic_name, exec_cmd, icon, comment,
      type || 'Application', terminal ? 1 : 0, categories, startup_notify ? 1 : 0,
      path_dir, mime_type, JSON.stringify(unsupported_fields || {}), JSON.stringify(other_sections || [])
    ]);
    
    res.status(201).json({
      id: result.insertId,
      filename,
      name,
      message: 'Desktop entry created successfully'
    });
  } catch (error) {
    console.error('Error creating entry:', error);
    res.status(500).json({ error: 'Failed to create desktop entry' });
  }
});

// PUT /api/entries/:id - Update entry
app.put('/api/entries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, generic_name, exec_cmd, icon, comment, type,
      terminal, categories, startup_notify, path_dir, mime_type,
      unsupported_fields, other_sections
    } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!exec_cmd || !exec_cmd.trim()) {
      return res.status(400).json({ error: 'Exec command is required' });
    }
    
    const [exists] = await pool.query('SELECT * FROM desktop_entries WHERE id = ?', [id]);
    if (exists.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    const oldEntry = exists[0];
    
    let filename = req.body.filename;
    if (!filename || !filename.trim()) {
      filename = oldEntry.filename;
    } else if (!filename.endsWith('.desktop')) {
      filename = filename.trim() + '.desktop';
    }
    
    if (filename !== oldEntry.filename) {
      const [conflict] = await pool.query('SELECT id FROM desktop_entries WHERE filename = ? AND id != ?', [filename, id]);
      if (conflict.length > 0) {
        return res.status(400).json({ error: `A desktop file named "${filename}" already exists.` });
      }
    }
    
    const desktopData = {
      name,
      genericName: generic_name,
      exec: exec_cmd,
      icon,
      comment,
      type: type || 'Application',
      terminal: !!terminal,
      categories,
      startupNotify: !!startup_notify,
      path: path_dir,
      mimeType: mime_type,
      unsupportedFields: unsupported_fields || JSON.parse(oldEntry.unsupported_fields || '{}'),
      otherSections: other_sections || JSON.parse(oldEntry.other_sections || '[]')
    };
    
    const content = stringifyDesktopFile(desktopData);
    const appsDir = process.env.APPLICATIONS_DIR || path.join(__dirname, '../applications');
    const oldFilePath = path.join(appsDir, oldEntry.filename);
    const newFilePath = path.join(appsDir, filename);
    
    if (filename !== oldEntry.filename) {
      try {
        await fs.unlink(oldFilePath);
      } catch (e) {
        console.warn(`Could not delete old file: ${oldFilePath}`, e.message);
      }
    }
    
    await fs.writeFile(newFilePath, content, 'utf-8');
    
    await pool.query(`
      UPDATE desktop_entries 
      SET filename = ?, name = ?, generic_name = ?, exec_cmd = ?, icon = ?, comment = ?, 
          type = ?, terminal = ?, categories = ?, startup_notify = ?, 
          path_dir = ?, mime_type = ?, unsupported_fields = ?, other_sections = ?
      WHERE id = ?
    `, [
      filename, name, generic_name, exec_cmd, icon, comment,
      type || 'Application', terminal ? 1 : 0, categories, startup_notify ? 1 : 0,
      path_dir, mime_type, JSON.stringify(desktopData.unsupportedFields), JSON.stringify(desktopData.otherSections),
      id
    ]);
    
    res.json({ message: 'Desktop entry updated successfully', filename });
  } catch (error) {
    console.error('Error updating entry:', error);
    res.status(500).json({ error: 'Failed to update desktop entry' });
  }
});

// DELETE /api/entries/:id - Delete entry
app.delete('/api/entries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT filename FROM desktop_entries WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    const { filename } = rows[0];
    
    const appsDir = process.env.APPLICATIONS_DIR || path.join(__dirname, '../applications');
    const filePath = path.join(appsDir, filename);
    try {
      await fs.unlink(filePath);
    } catch (e) {
      console.warn(`File could not be deleted from disk: ${filePath}`, e.message);
    }
    
    await pool.query('DELETE FROM desktop_entries WHERE id = ?', [id]);
    res.json({ message: 'Desktop entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting entry:', error);
    res.status(500).json({ error: 'Failed to delete desktop entry' });
  }
});

// POST /api/entries/sync - Force database refresh from files
app.post('/api/entries/sync', async (req, res) => {
  try {
    await syncFilesToDatabase();
    res.json({ message: 'Files synchronized with database successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Synchronization failed' });
  }
});

// POST /api/entries/bulk-update - Mass editing
app.post('/api/entries/bulk-update', async (req, res) => {
  try {
    const { ids, updates } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'IDs array is required' });
    }
    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Updates object is required' });
    }
    
    const [entries] = await pool.query('SELECT * FROM desktop_entries WHERE id IN (?)', [ids]);
    if (entries.length === 0) {
      return res.status(404).json({ error: 'No matching entries found' });
    }
    
    const appsDir = process.env.APPLICATIONS_DIR || path.join(__dirname, '../applications');
    
    for (const entry of entries) {
      const name = updates.name !== undefined ? updates.name : entry.name;
      const generic_name = updates.generic_name !== undefined ? updates.generic_name : entry.generic_name;
      const exec_cmd = updates.exec_cmd !== undefined ? updates.exec_cmd : entry.exec_cmd;
      const icon = updates.icon !== undefined ? updates.icon : entry.icon;
      const comment = updates.comment !== undefined ? updates.comment : entry.comment;
      const type = updates.type !== undefined ? updates.type : entry.type;
      const terminal = updates.terminal !== undefined ? updates.terminal : entry.terminal;
      const categories = updates.categories !== undefined ? updates.categories : entry.categories;
      const startup_notify = updates.startup_notify !== undefined ? updates.startup_notify : entry.startup_notify;
      const path_dir = updates.path_dir !== undefined ? updates.path_dir : entry.path_dir;
      const mime_type = updates.mime_type !== undefined ? updates.mime_type : entry.mime_type;
      
      const unsupportedFields = JSON.parse(entry.unsupported_fields || '{}');
      const otherSections = JSON.parse(entry.other_sections || '[]');
      
      const desktopData = {
        name,
        genericName: generic_name,
        exec: exec_cmd,
        icon,
        comment,
        type: type || 'Application',
        terminal: !!terminal,
        categories,
        startupNotify: !!startup_notify,
        path: path_dir,
        mimeType: mime_type,
        unsupportedFields,
        otherSections
      };
      
      const content = stringifyDesktopFile(desktopData);
      const filePath = path.join(appsDir, entry.filename);
      
      await fs.writeFile(filePath, content, 'utf-8');
      
      await pool.query(`
        UPDATE desktop_entries 
        SET name = ?, generic_name = ?, exec_cmd = ?, icon = ?, comment = ?, 
            type = ?, terminal = ?, categories = ?, startup_notify = ?, 
            path_dir = ?, mime_type = ?
        WHERE id = ?
      `, [
        name, generic_name, exec_cmd, icon, comment,
        type, terminal ? 1 : 0, categories, startup_notify ? 1 : 0,
        path_dir, mime_type, entry.id
      ]);
    }
    
    res.json({ message: `Successfully updated ${entries.length} entries` });
  } catch (error) {
    console.error('Bulk update failed:', error);
    res.status(500).json({ error: 'Bulk update failed' });
  }
});

// POST /api/entries/bulk-delete - Mass deleting
app.post('/api/entries/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'IDs array is required' });
    }
    
    const [entries] = await pool.query('SELECT id, filename FROM desktop_entries WHERE id IN (?)', [ids]);
    if (entries.length === 0) {
      return res.status(404).json({ error: 'No matching entries found' });
    }
    
    const appsDir = process.env.APPLICATIONS_DIR || path.join(__dirname, '../applications');
    
    for (const entry of entries) {
      const filePath = path.join(appsDir, entry.filename);
      try {
        await fs.unlink(filePath);
      } catch (e) {
        console.warn(`Could not delete file: ${filePath}`, e.message);
      }
    }
    
    await pool.query('DELETE FROM desktop_entries WHERE id IN (?)', [ids]);
    res.json({ message: `Successfully deleted ${entries.length} entries` });
  } catch (error) {
    console.error('Bulk delete failed:', error);
    res.status(500).json({ error: 'Bulk delete failed' });
  }
});

// Start the Express server
bootstrapDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
