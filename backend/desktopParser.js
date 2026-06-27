const fs = require('fs');

function parseDesktopFile(content) {
  const lines = content.split(/\r?\n/);
  const data = {
    name: '',
    genericName: '',
    exec: '',
    icon: '',
    comment: '',
    type: 'Application',
    terminal: false,
    categories: '',
    startupNotify: false,
    path: '',
    mimeType: '',
    unsupportedFields: {},
    otherSections: []
  };

  let currentSection = null;
  let otherSectionLines = [];

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentSection && currentSection !== '[Desktop Entry]') {
        otherSectionLines.push(line);
      }
      continue;
    }
    if (trimmed.startsWith('#')) {
      if (currentSection && currentSection !== '[Desktop Entry]') {
        otherSectionLines.push(line);
      }
      continue;
    }

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      if (currentSection && currentSection !== '[Desktop Entry]') {
        data.otherSections.push({
          header: currentSection,
          lines: [...otherSectionLines]
        });
        otherSectionLines = [];
      }
      currentSection = trimmed;
      continue;
    }

    if (currentSection === '[Desktop Entry]') {
      const idx = line.indexOf('=');
      if (idx !== -1) {
        const key = line.substring(0, idx).trim();
        const value = line.substring(idx + 1).trim();

        if (key === 'Name') data.name = value;
        else if (key === 'GenericName') data.genericName = value;
        else if (key === 'Exec') data.exec = value;
        else if (key === 'Icon') data.icon = value;
        else if (key === 'Comment') data.comment = value;
        else if (key === 'Type') data.type = value;
        else if (key === 'Terminal') data.terminal = (value.toLowerCase() === 'true');
        else if (key === 'Categories') data.categories = value;
        else if (key === 'StartupNotify') data.startupNotify = (value.toLowerCase() === 'true');
        else if (key === 'Path') data.path = value;
        else if (key === 'MimeType') data.mimeType = value;
        else {
          data.unsupportedFields[key] = value;
        }
      }
    } else if (currentSection) {
      otherSectionLines.push(line);
    }
  }

  if (currentSection && currentSection !== '[Desktop Entry]' && otherSectionLines.length > 0) {
    data.otherSections.push({
      header: currentSection,
      lines: [...otherSectionLines]
    });
  }

  return data;
}

function stringifyDesktopFile(data) {
  let lines = ['[Desktop Entry]'];
  lines.push(`Type=${data.type || 'Application'}`);
  lines.push(`Name=${data.name || ''}`);
  if (data.genericName) lines.push(`GenericName=${data.genericName}`);
  lines.push(`Exec=${data.exec || ''}`);
  if (data.icon) lines.push(`Icon=${data.icon}`);
  if (data.comment) lines.push(`Comment=${data.comment}`);
  lines.push(`Terminal=${data.terminal ? 'true' : 'false'}`);
  if (data.categories) lines.push(`Categories=${data.categories}`);
  lines.push(`StartupNotify=${data.startupNotify ? 'true' : 'false'}`);
  if (data.path) lines.push(`Path=${data.path}`);
  if (data.mimeType) lines.push(`MimeType=${data.mimeType}`);

  if (data.unsupportedFields) {
    for (const [key, value] of Object.entries(data.unsupportedFields)) {
      lines.push(`${key}=${value}`);
    }
  }

  if (data.otherSections && Array.isArray(data.otherSections)) {
    for (const sec of data.otherSections) {
      lines.push('');
      lines.push(sec.header);
      for (const line of sec.lines) {
        lines.push(line);
      }
    }
  }

  return lines.join('\n') + '\n';
}

module.exports = { parseDesktopFile, stringifyDesktopFile };
