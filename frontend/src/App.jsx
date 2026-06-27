import React, { useState, useEffect } from 'react';
import { 
  Layers, Search, Plus, Trash2, Edit, RefreshCw, FileText, 
  Terminal, Check, X, ChevronLeft, ChevronRight, Settings, Info,
  Folder, Link as LinkIcon, Sliders
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

const getIconForType = (type, size = 16) => {
  switch (type) {
    case 'Link': return <LinkIcon size={size} />;
    case 'Directory': return <Folder size={size} />;
    default: return <Settings size={size} />;
  }
};

function AppIcon({ icon, type, size = 16, fallbackIcon, className = '' }) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [icon]);

  if (icon && !hasError) {
    return (
      <img 
        src={`${API_BASE}/icons/${encodeURIComponent(icon)}`} 
        alt="" 
        className={className}
        onError={() => setHasError(true)}
      />
    );
  }

  if (fallbackIcon) {
    return fallbackIcon;
  }

  return getIconForType(type, size);
}

function App() {
  // State variables
  const [entries, setEntries] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [selectedEntry, setSelectedEntry] = useState(null);
  
  // Form state
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  // Icon Picker state
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [iconSearchQuery, setIconSearchQuery] = useState('');
  const [iconPickerResults, setIconPickerResults] = useState([]);
  const [isSearchingIcons, setIsSearchingIcons] = useState(false);
  const [formData, setFormData] = useState({
    filename: '',
    name: '',
    generic_name: '',
    exec_cmd: '',
    icon: '',
    comment: '',
    type: 'Application',
    terminal: false,
    categories: '',
    startup_notify: false,
    path_dir: '',
    mime_type: ''
  });

  // Bulk Operations State
  const [selectedIds, setSelectedIds] = useState([]);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [bulkUpdates, setBulkUpdates] = useState({
    categories: '',
    type: 'Application',
    terminal: false,
    startup_notify: false
  });
  const [bulkFieldsToApply, setBulkFieldsToApply] = useState({
    categories: false,
    type: false,
    terminal: false,
    startup_notify: false
  });

  // UI state
  const [toast, setToast] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Categories list for filtering
  const categoriesList = [
    'AudioVideo', 'Development', 'Education', 'Game', 'Graphics', 
    'Network', 'Office', 'Settings', 'System', 'Utility', 
    'TerminalEmulator', 'WebBrowser'
  ];

  // Show Toast helper
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Fetch entries
  const fetchEntries = async (pageNumber = 1) => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: pageNumber,
        limit: 10,
        search,
        category
      });
      const response = await fetch(`${API_BASE}/entries?${queryParams.toString()}`);
      if (!response.ok) throw new Error('Falha ao buscar atalhos.');
      const data = await response.json();
      setEntries(data.entries);
      setPagination(data.pagination);
      
      // If we have selected an entry, keep it updated or clear if it is gone
      if (selectedId) {
        const stillExists = data.entries.find(e => e.id === selectedId);
        if (!stillExists && data.entries.length > 0) {
          // If editing or viewing, fetch full details for the selected one separately
          fetchEntryDetails(selectedId);
        } else if (!stillExists) {
          setSelectedId(null);
          setSelectedEntry(null);
        }
      }
    } catch (error) {
      console.error(error);
      showToast(error.message || 'Erro ao conectar com o servidor.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch details of a single entry
  const fetchEntryDetails = async (id) => {
    try {
      const response = await fetch(`${API_BASE}/entries/${id}`);
      if (!response.ok) throw new Error('Atalho não encontrado.');
      const data = await response.json();
      setSelectedEntry(data);
    } catch (error) {
      showToast(error.message, 'error');
      setSelectedId(null);
      setSelectedEntry(null);
    }
  };

  // Trigger fetch on search, category change or page change
  useEffect(() => {
    fetchEntries(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  // Icon Picker functions
  const openIconPicker = () => {
    setIsIconPickerOpen(true);
    setIconSearchQuery('');
    setIconPickerResults([]);
    fetchIcons('');
  };

  const fetchIcons = async (query) => {
    setIsSearchingIcons(true);
    try {
      const res = await fetch(`${API_BASE}/icons/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setIconPickerResults(data);
      }
    } catch (error) {
      console.error('Error fetching icons:', error);
    } finally {
      setIsSearchingIcons(false);
    }
  };

  useEffect(() => {
    if (isIconPickerOpen) {
      const delayDebounce = setTimeout(() => {
        fetchIcons(iconSearchQuery);
      }, 300);
      return () => clearTimeout(delayDebounce);
    }
  }, [iconSearchQuery, isIconPickerOpen]);

  // Handle Search Debounce / Trigger on enter or click search
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchEntries(1);
  };

  // Select entry
  const handleSelectEntry = (id) => {
    setSelectedId(id);
    setIsEditing(false);
    setIsCreating(false);
    setIsBulkEditing(false);
    fetchEntryDetails(id);
  };

  // Handle Sync
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch(`${API_BASE}/entries/sync`, { method: 'POST' });
      if (!response.ok) throw new Error('Sincronização falhou.');
      const data = await response.json();
      showToast(data.message || 'Sincronização concluída!');
      fetchEntries(pagination.page);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Setup form for Creating
  const handleStartCreate = () => {
    setFormData({
      filename: '',
      name: '',
      generic_name: '',
      exec_cmd: '',
      icon: '',
      comment: '',
      type: 'Application',
      terminal: false,
      categories: '',
      startup_notify: false,
      path_dir: '',
      mime_type: ''
    });
    setIsCreating(true);
    setIsEditing(false);
    setIsBulkEditing(false);
  };

  // Setup form for Editing
  const handleStartEdit = () => {
    if (!selectedEntry) return;
    setFormData({
      filename: selectedEntry.filename,
      name: selectedEntry.name,
      generic_name: selectedEntry.generic_name || '',
      exec_cmd: selectedEntry.exec_cmd,
      icon: selectedEntry.icon || '',
      comment: selectedEntry.comment || '',
      type: selectedEntry.type || 'Application',
      terminal: !!selectedEntry.terminal,
      categories: selectedEntry.categories || '',
      startup_notify: !!selectedEntry.startup_notify,
      path_dir: selectedEntry.path_dir || '',
      mime_type: selectedEntry.mime_type || ''
    });
    setIsEditing(true);
    setIsCreating(false);
    setIsBulkEditing(false);
  };

  // Save Form (Create or Edit)
  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return showToast('O nome é obrigatório.', 'error');
    if (!formData.exec_cmd.trim()) return showToast('O comando de execução é obrigatório.', 'error');

    const method = isCreating ? 'POST' : 'PUT';
    const url = isCreating ? `${API_BASE}/entries` : `${API_BASE}/entries/${selectedId}`;

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Falha ao salvar atalho.');

      showToast(result.message || 'Atalho salvo com sucesso!');
      setIsCreating(false);
      setIsEditing(false);
      
      if (isCreating) {
        setSelectedId(result.id);
        fetchEntryDetails(result.id);
        fetchEntries(1);
      } else {
        fetchEntryDetails(selectedId);
        fetchEntries(pagination.page);
      }
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  // Delete Entry
  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este atalho do sistema e deletar o arquivo correspondente?')) return;
    try {
      const response = await fetch(`${API_BASE}/entries/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Falha ao excluir atalho.');
      }
      showToast('Atalho excluído com sucesso.');
      setSelectedId(null);
      setSelectedEntry(null);
      fetchEntries(pagination.page);
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  // Handle Checkbox Selection for Bulk Operations
  const handleToggleSelectId = (id, e) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(item => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleSelectAllOnPage = () => {
    const pageIds = entries.map(e => e.id);
    const allSelected = pageIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !pageIds.includes(id)));
    } else {
      setSelectedIds(prev => {
        const union = new Set([...prev, ...pageIds]);
        return Array.from(union);
      });
    }
  };

  const handleClearBulkSelection = () => {
    setSelectedIds([]);
    setIsBulkEditing(false);
  };

  // Trigger Bulk Edit Mode
  const handleStartBulkEdit = () => {
    setIsBulkEditing(true);
    setIsCreating(false);
    setIsEditing(false);
    setBulkUpdates({
      categories: '',
      type: 'Application',
      terminal: false,
      startup_notify: false
    });
    setBulkFieldsToApply({
      categories: false,
      type: false,
      terminal: false,
      startup_notify: false
    });
  };

  // Save Bulk Updates
  const handleSaveBulk = async (e) => {
    e.preventDefault();
    
    // Construct updates object with only selected fields
    const updates = {};
    let hasUpdates = false;
    
    for (const key in bulkFieldsToApply) {
      if (bulkFieldsToApply[key]) {
        updates[key] = bulkUpdates[key];
        hasUpdates = true;
      }
    }
    
    if (!hasUpdates) {
      return showToast('Selecione pelo menos um campo para aplicar a alteração em massa.', 'error');
    }

    try {
      const response = await fetch(`${API_BASE}/entries/bulk-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, updates })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Falha na atualização em massa.');

      showToast(result.message || 'Atalhos atualizados em massa com sucesso!');
      setIsBulkEditing(false);
      setSelectedIds([]);
      fetchEntries(pagination.page);
      if (selectedId && selectedIds.includes(selectedId)) {
        fetchEntryDetails(selectedId);
      }
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  // Delete Bulk Selected Entries
  const handleDeleteBulk = async () => {
    if (!window.confirm(`Tem certeza que deseja excluir permanentemente os ${selectedIds.length} atalhos selecionados e todos os seus arquivos?`)) return;
    try {
      const response = await fetch(`${API_BASE}/entries/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Falha ao excluir atalhos em massa.');

      showToast(result.message || 'Atalhos excluídos com sucesso.');
      setSelectedIds([]);
      setIsBulkEditing(false);
      setSelectedId(null);
      setSelectedEntry(null);
      fetchEntries(1);
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  // Form Fields updates helper
  const handleFormChange = (key, val) => {
    setFormData(prev => ({ ...prev, [key]: val }));
  };

  // Bulk Form Fields updates helper
  const handleBulkChange = (key, val) => {
    setBulkUpdates(prev => ({ ...prev, [key]: val }));
  };

  const toggleBulkFieldApply = (key) => {
    setBulkFieldsToApply(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Helper to get raw file preview simulation
  const getRawContentPreview = (entry) => {
    if (!entry) return '';
    let lines = ['[Desktop Entry]', `Type=${entry.type || 'Application'}`, `Name=${entry.name}`];
    if (entry.generic_name) lines.push(`GenericName=${entry.generic_name}`);
    lines.push(`Exec=${entry.exec_cmd}`);
    if (entry.icon) lines.push(`Icon=${entry.icon}`);
    if (entry.comment) lines.push(`Comment=${entry.comment}`);
    lines.push(`Terminal=${entry.terminal ? 'true' : 'false'}`);
    if (entry.categories) lines.push(`Categories=${entry.categories}`);
    lines.push(`StartupNotify=${entry.startup_notify ? 'true' : 'false'}`);
    if (entry.path_dir) lines.push(`Path=${entry.path_dir}`);
    if (entry.mime_type) lines.push(`MimeType=${entry.mime_type}`);
    
    // append unsupported fields
    if (entry.unsupported_fields) {
      for (const [key, val] of Object.entries(entry.unsupported_fields)) {
        lines.push(`${key}=${val}`);
      }
    }

    // append other sections
    if (entry.other_sections && Array.isArray(entry.other_sections)) {
      entry.other_sections.forEach(sec => {
        lines.push('', sec.header);
        sec.lines.forEach(l => lines.push(l));
      });
    }

    return lines.join('\n');
  };

  return (
    <div className="root-sub">
      {/* Toast Notification */}
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            {toast.type === 'success' && <Check size={18} />}
            {toast.type === 'error' && <X size={18} />}
            {toast.type === 'info' && <Info size={18} />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* App Header */}
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-icon">
            <Layers size={32} />
          </div>
          <div>
            <h1 className="brand-title">.Desktop Editor</h1>
            <div className="brand-subtitle">Editor e Gerenciador de Entradas de Aplicativos (.desktop)</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button className="sync-btn" onClick={handleSync} disabled={isSyncing}>
            <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
            {isSyncing ? 'Sincronizando...' : 'Sincronizar Arquivos'}
          </button>
          <div className="user-badge">
            <Info size={14} />
            <span>Aluno: <span className="user-badge-highlight">Drew</span></span>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="app-container">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-controls">
            {/* Search Form */}
            <form onSubmit={handleSearchSubmit} className="search-wrapper">
              <input 
                type="text" 
                placeholder="Pesquisar atalhos (nome, comando)..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="search-input"
              />
              <Search size={16} className="search-icon" />
              <button type="submit" style={{ display: 'none' }} />
            </form>

            <div className="filter-row">
              {/* Category Filter */}
              <select 
                value={category} 
                onChange={e => setCategory(e.target.value)}
                className="category-select"
              >
                <option value="">Todas as Categorias</option>
                {categoriesList.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              {/* New Shortcut Button */}
              <button className="new-btn" onClick={handleStartCreate}>
                <Plus size={16} />
                Novo
              </button>
            </div>

            {/* Bulk Actions Indicator */}
            {selectedIds.length > 0 && (
              <div className="bulk-actions-bar">
                <span><span>{selectedIds.length}</span> selecionados</span>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button onClick={handleStartBulkEdit}>
                    Editar em Massa
                  </button>
                  <button 
                    onClick={handleDeleteBulk}
                    style={{ borderColor: 'var(--error-color)', color: 'var(--error-color)' }}
                  >
                    Excluir
                  </button>
                  <button onClick={handleClearBulkSelection} style={{ padding: '0.2rem' }}>
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* List Area */}
          <div className="entries-list">
            {isLoading ? (
              <div className="empty-state">Carregando atalhos...</div>
            ) : entries.length === 0 ? (
              <div className="empty-state">Nenhum atalho encontrado. Crie um novo!</div>
            ) : (
              <>
                {/* Select All Checkbox header */}
                <div className="entry-item" style={{ backgroundColor: 'rgba(51, 65, 85, 0.15)', cursor: 'default' }}>
                  <div className="checkbox-container" onClick={handleSelectAllOnPage}>
                    <input 
                      type="checkbox" 
                      className="checkbox-input"
                      checked={entries.every(e => selectedIds.includes(e.id))}
                      onChange={handleSelectAllOnPage}
                    />
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Selecionar Todos nesta página
                  </span>
                </div>

                {entries.map(entry => (
                  <div 
                    key={entry.id} 
                    className={`entry-item ${selectedId === entry.id ? 'active' : ''}`}
                    onClick={() => handleSelectEntry(entry.id)}
                  >
                    <div className="checkbox-container" onClick={(e) => handleToggleSelectId(entry.id, e)}>
                      <input 
                        type="checkbox" 
                        className="checkbox-input"
                        checked={selectedIds.includes(entry.id)}
                        onChange={(e) => handleToggleSelectId(entry.id, e)}
                        onClick={e => e.stopPropagation()}
                      />
                    </div>
                    
                    <div className="entry-icon-preview">
                      <AppIcon icon={entry.icon} type={entry.type} size={16} className="entry-icon-image" />
                    </div>

                    <div className="entry-info">
                      <div className="entry-name-row">
                        <h3 className="entry-title">{entry.name}</h3>
                        {entry.type && (
                          <span className="entry-category-tag" style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                            {getIconForType(entry.type)}
                            {entry.type}
                          </span>
                        )}
                      </div>
                      <div className="entry-exec">{entry.exec_cmd}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Pagination */}
          <div className="pagination-controls">
            <span>Total: {pagination.total}</span>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <button 
                className="pagination-btn"
                disabled={pagination.page <= 1}
                onClick={() => fetchEntries(pagination.page - 1)}
              >
                <ChevronLeft size={14} />
              </button>
              <span>{pagination.page} / {pagination.totalPages || 1}</span>
              <button 
                className="pagination-btn"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchEntries(pagination.page + 1)}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </aside>

        {/* Right workspace (Editor / Details) */}
        <main className="workspace">
          {isBulkEditing ? (
            /* BULK EDIT PANEL */
            <div className="bulk-panel-card animate-fadeIn">
              <div className="bulk-panel-header">
                <h2 className="bulk-panel-title">Edição em Massa (Editar {selectedIds.length} Atalhos)</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  Marque as caixas de seleção ao lado dos campos que você deseja alterar para todos os atalhos selecionados.
                </p>
              </div>

              <form onSubmit={handleSaveBulk} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="bulk-selection-list">
                  {selectedIds.map(id => {
                    const found = entries.find(e => e.id === id);
                    return (
                      <div key={id} className="bulk-selected-pill">
                        <span>{found ? found.name : `ID: ${id}`}</span>
                        <button type="button" onClick={(e) => handleToggleSelectId(id, e)}>&times;</button>
                      </div>
                    );
                  })}
                </div>

                <div className="form-grid">
                  {/* Category Bulk Update */}
                  <div className="form-group" style={{ borderLeft: bulkFieldsToApply.categories ? '2px solid var(--accent-color)' : '2px solid transparent', paddingLeft: '0.5rem' }}>
                    <label className="form-checkbox-row">
                      <input 
                        type="checkbox" 
                        checked={bulkFieldsToApply.categories}
                        onChange={() => toggleBulkFieldApply('categories')}
                        className="form-checkbox-input"
                      />
                      <span className="form-label" style={{ cursor: 'pointer' }}>Alterar Categorias</span>
                    </label>
                    <input 
                      type="text" 
                      placeholder="Ex: System;Utility;" 
                      value={bulkUpdates.categories}
                      onChange={e => handleBulkChange('categories', e.target.value)}
                      disabled={!bulkFieldsToApply.categories}
                      className="form-input"
                    />
                  </div>

                  {/* Type Bulk Update */}
                  <div className="form-group" style={{ borderLeft: bulkFieldsToApply.type ? '2px solid var(--accent-color)' : '2px solid transparent', paddingLeft: '0.5rem' }}>
                    <label className="form-checkbox-row">
                      <input 
                        type="checkbox" 
                        checked={bulkFieldsToApply.type}
                        onChange={() => toggleBulkFieldApply('type')}
                        className="form-checkbox-input"
                      />
                      <span className="form-label" style={{ cursor: 'pointer' }}>Alterar Tipo (Type)</span>
                    </label>
                    <select 
                      value={bulkUpdates.type} 
                      onChange={e => handleBulkChange('type', e.target.value)}
                      disabled={!bulkFieldsToApply.type}
                      className="form-select"
                    >
                      <option value="Application">Application</option>
                      <option value="Link">Link</option>
                      <option value="Directory">Directory</option>
                    </select>
                  </div>

                  {/* Terminal Bulk Update */}
                  <div className="form-group" style={{ borderLeft: bulkFieldsToApply.terminal ? '2px solid var(--accent-color)' : '2px solid transparent', paddingLeft: '0.5rem' }}>
                    <label className="form-checkbox-row">
                      <input 
                        type="checkbox" 
                        checked={bulkFieldsToApply.terminal}
                        onChange={() => toggleBulkFieldApply('terminal')}
                        className="form-checkbox-input"
                      />
                      <span className="form-label" style={{ cursor: 'pointer' }}>Alterar Executar no Terminal</span>
                    </label>
                    <label className="form-checkbox-row" style={{ paddingLeft: '1.5rem', opacity: bulkFieldsToApply.terminal ? 1 : 0.5 }}>
                      <input 
                        type="checkbox" 
                        checked={bulkUpdates.terminal}
                        onChange={e => handleBulkChange('terminal', e.target.checked)}
                        disabled={!bulkFieldsToApply.terminal}
                        className="form-checkbox-input"
                      />
                      <span>Executar no Terminal</span>
                    </label>
                  </div>

                  {/* Startup Notify Bulk Update */}
                  <div className="form-group" style={{ borderLeft: bulkFieldsToApply.startup_notify ? '2px solid var(--accent-color)' : '2px solid transparent', paddingLeft: '0.5rem' }}>
                    <label className="form-checkbox-row">
                      <input 
                        type="checkbox" 
                        checked={bulkFieldsToApply.startup_notify}
                        onChange={() => toggleBulkFieldApply('startup_notify')}
                        className="form-checkbox-input"
                      />
                      <span className="form-label" style={{ cursor: 'pointer' }}>Alterar Notificação de Inicialização</span>
                    </label>
                    <label className="form-checkbox-row" style={{ paddingLeft: '1.5rem', opacity: bulkFieldsToApply.startup_notify ? 1 : 0.5 }}>
                      <input 
                        type="checkbox" 
                        checked={bulkUpdates.startup_notify}
                        onChange={e => handleBulkChange('startup_notify', e.target.checked)}
                        disabled={!bulkFieldsToApply.startup_notify}
                        className="form-checkbox-input"
                      />
                      <span>Ativar Notificação</span>
                    </label>
                  </div>
                </div>

                <div className="form-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setIsBulkEditing(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary">
                    <Check size={16} /> Aplicar nos {selectedIds.length} Atalhos
                  </button>
                </div>
              </form>
            </div>
          ) : isCreating || isEditing ? (
            /* CREATE OR EDIT FORM */
            <div className="form-card animate-fadeIn">
              <h2 className="form-header-title">{isCreating ? 'Criar Novo Atalho' : `Editar Atalho: ${formData.name}`}</h2>
              
              <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="form-grid">
                  {/* Filename */}
                  <div className="form-group">
                    <label className="form-label">Nome do Arquivo (.desktop)</label>
                    <input 
                      type="text" 
                      placeholder="Ex: meu-app.desktop (Opcional)" 
                      value={formData.filename}
                      onChange={e => handleFormChange('filename', e.target.value)}
                      disabled={isEditing} /* Do not edit filename directly to avoid conflicts, or handle with care */
                      className="form-input mono"
                    />
                    <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      Se deixado em branco, será gerado com base no nome do aplicativo.
                    </small>
                  </div>

                  {/* Name */}
                  <div className="form-group">
                    <label className="form-label">Nome do Aplicativo (Name) *</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Firefox Web Browser" 
                      value={formData.name}
                      onChange={e => handleFormChange('name', e.target.value)}
                      required
                      className="form-input"
                    />
                  </div>

                  {/* Generic Name */}
                  <div className="form-group">
                    <label className="form-label">Nome Genérico (GenericName)</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Navegador Web" 
                      value={formData.generic_name}
                      onChange={e => handleFormChange('generic_name', e.target.value)}
                      className="form-input"
                    />
                  </div>

                  {/* Exec Command */}
                  <div className="form-group">
                    <label className="form-label">Comando de Execução (Exec) *</label>
                    <input 
                      type="text" 
                      placeholder="Ex: firefox %u" 
                      value={formData.exec_cmd}
                      onChange={e => handleFormChange('exec_cmd', e.target.value)}
                      required
                      className="form-input mono"
                    />
                  </div>

                  {/* Icon */}
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Nome do Ícone (Icon)</label>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <div className="entry-icon-preview" style={{ width: '42px', height: '42px', minWidth: '42px', backgroundColor: 'var(--bg-primary)' }}>
                        <AppIcon icon={formData.icon} type={formData.type} size={24} className="entry-icon-image" />
                      </div>
                      <input 
                        type="text" 
                        placeholder="Ex: firefox ou /caminho/icone.png" 
                        value={formData.icon}
                        onChange={e => handleFormChange('icon', e.target.value)}
                        className="form-input"
                        style={{ flex: 1 }}
                      />
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        onClick={openIconPicker}
                        style={{ height: '42px', whiteSpace: 'nowrap' }}
                      >
                        <Search size={16} /> Escolher Ícone
                      </button>
                    </div>
                  </div>

                  {/* Type */}
                  <div className="form-group">
                    <label className="form-label">Tipo (Type)</label>
                    <select 
                      value={formData.type} 
                      onChange={e => handleFormChange('type', e.target.value)}
                      className="form-select"
                    >
                      <option value="Application">Application (Aplicativo)</option>
                      <option value="Link">Link (Link Web)</option>
                      <option value="Directory">Directory (Diretório)</option>
                    </select>
                  </div>

                  {/* Comment */}
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Descrição / Comentário (Comment)</label>
                    <textarea 
                      placeholder="Ex: Navegar na Internet" 
                      value={formData.comment}
                      onChange={e => handleFormChange('comment', e.target.value)}
                      className="form-textarea"
                    />
                  </div>

                  {/* Categories */}
                  <div className="form-group">
                    <label className="form-label">Categorias (separadas por ponto e vírgula)</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Network;WebBrowser;" 
                      value={formData.categories}
                      onChange={e => handleFormChange('categories', e.target.value)}
                      className="form-input"
                    />
                  </div>

                  {/* Path */}
                  <div className="form-group">
                    <label className="form-label">Diretório de Trabalho (Path)</label>
                    <input 
                      type="text" 
                      placeholder="Ex: /home/usuario/diretorio" 
                      value={formData.path_dir}
                      onChange={e => handleFormChange('path_dir', e.target.value)}
                      className="form-input mono"
                    />
                  </div>

                  {/* MimeType */}
                  <div className="form-group">
                    <label className="form-label">Tipos Mime (MimeType)</label>
                    <input 
                      type="text" 
                      placeholder="Ex: text/html;text/xml;" 
                      value={formData.mime_type}
                      onChange={e => handleFormChange('mime_type', e.target.value)}
                      className="form-input mono"
                    />
                  </div>

                  {/* Boolean settings */}
                  <div className="form-group" style={{ justifyContent: 'center' }}>
                    <label className="form-checkbox-row">
                      <input 
                        type="checkbox" 
                        checked={formData.terminal}
                        onChange={e => handleFormChange('terminal', e.target.checked)}
                        className="form-checkbox-input"
                      />
                      <span>Executar no Terminal (Terminal)</span>
                    </label>

                    <label className="form-checkbox-row">
                      <input 
                        type="checkbox" 
                        checked={formData.startup_notify}
                        onChange={e => handleFormChange('startup_notify', e.target.checked)}
                        className="form-checkbox-input"
                      />
                      <span>Notificação de Inicialização (StartupNotify)</span>
                    </label>
                  </div>
                </div>

                <div className="form-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => {
                      setIsCreating(false);
                      setIsEditing(false);
                    }}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary">
                    <Check size={16} /> Salvar Atalho
                  </button>
                </div>
              </form>
            </div>
          ) : selectedEntry ? (
            /* VIEW DETAIL CARD */
            <div className="detail-card animate-fadeIn">
              <div className="detail-header">
                <div className="detail-title-section">
                  <div className="detail-icon-box">
                    <AppIcon 
                      icon={selectedEntry.icon} 
                      type={selectedEntry.type} 
                      size={32} 
                      className="detail-icon-image"
                      fallbackIcon={<Sliders size={32} />}
                    />
                  </div>
                  <div className="detail-info">
                    <h2 className="detail-name">{selectedEntry.name}</h2>
                    <span className="detail-filename">{selectedEntry.filename}</span>
                  </div>
                </div>
                <div className="action-buttons">
                  <button className="btn btn-secondary" onClick={handleStartEdit}>
                    <Edit size={16} /> Editar
                  </button>
                  <button className="btn btn-danger" onClick={() => handleDelete(selectedEntry.id)}>
                    <Trash2 size={16} /> Excluir
                  </button>
                </div>
              </div>

              {/* Data values grid */}
              <div className="detail-grid">
                {selectedEntry.generic_name && (
                  <div className="field-box">
                    <span className="field-label">Nome Genérico (GenericName)</span>
                    <span className="field-value">{selectedEntry.generic_name}</span>
                  </div>
                )}

                <div className="field-box">
                  <span className="field-label">Comando de Execução (Exec)</span>
                  <span className="field-value mono">{selectedEntry.exec_cmd}</span>
                </div>

                {selectedEntry.icon && (
                  <div className="field-box">
                    <span className="field-label">Nome do Ícone (Icon)</span>
                    <span className="field-value">{selectedEntry.icon}</span>
                  </div>
                )}

                <div className="field-box">
                  <span className="field-label">Tipo de Atalho (Type)</span>
                  <span className="field-value">{selectedEntry.type || 'Application'}</span>
                </div>

                {selectedEntry.comment && (
                  <div className="field-box" style={{ gridColumn: 'span 2' }}>
                    <span className="field-label">Descrição (Comment)</span>
                    <span className="field-value">{selectedEntry.comment}</span>
                  </div>
                )}

                {selectedEntry.path_dir && (
                  <div className="field-box">
                    <span className="field-label">Diretório de Trabalho (Path)</span>
                    <span className="field-value mono">{selectedEntry.path_dir}</span>
                  </div>
                )}

                {selectedEntry.mime_type && (
                  <div className="field-box">
                    <span className="field-label">Mime Types (MimeType)</span>
                    <span className="field-value mono">{selectedEntry.mime_type}</span>
                  </div>
                )}

                <div className="field-box">
                  <span className="field-label">Configurações Booleanas</span>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
                    <span className={`field-value checkbox-pill ${selectedEntry.terminal ? 'active' : 'inactive'}`}>
                      <Terminal size={14} />
                      Terminal: {selectedEntry.terminal ? 'Sim' : 'Não'}
                    </span>
                    <span className={`field-value checkbox-pill ${selectedEntry.startup_notify ? 'active' : 'inactive'}`}>
                      <Info size={14} />
                      StartupNotify: {selectedEntry.startup_notify ? 'Sim' : 'Não'}
                    </span>
                  </div>
                </div>

                <div className="field-box" style={{ gridColumn: 'span 2' }}>
                  <span className="field-label">Categorias</span>
                  <div className="tags-container">
                    {selectedEntry.categories ? (
                      selectedEntry.categories.split(';').filter(Boolean).map(tag => (
                        <span key={tag} className="tag">{tag}</span>
                      ))
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>Nenhuma categoria atribuída</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Raw File Preview Section */}
              <div className="preview-section">
                <div className="preview-header">
                  <h3 className="preview-title">Visualização do Arquivo de Entrada (.desktop)</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <FileText size={12} />
                    Representação do conteúdo do arquivo em disco
                  </span>
                </div>
                <div className="raw-content-box">
                  {getRawContentPreview(selectedEntry)}
                </div>
              </div>
            </div>
          ) : (
            /* DEFAULT / EMPTY WORKSPACE VIEW */
            <div 
              style={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                textAlign: 'center',
                color: 'var(--text-secondary)',
                gap: '1rem',
                border: '2px dashed var(--border-color)',
                borderRadius: '12px',
                padding: '2rem'
              }}
            >
              <Layers size={64} style={{ color: 'var(--border-color)' }} />
              <div>
                <h2>.Desktop Web Editor</h2>
                <p style={{ maxWidth: '450px', margin: '0.5rem auto 0 auto', fontSize: '0.95rem' }}>
                  Selecione um atalho na barra lateral para ver os detalhes, editar suas propriedades e visualizar o código do arquivo. Use o botão <strong>Novo</strong> para criar uma nova entrada.
                </p>
              </div>
              <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
                <button className="btn btn-primary" onClick={handleStartCreate}>
                  <Plus size={16} /> Criar Novo Atalho
                </button>
                <button className="btn btn-secondary" onClick={handleSync}>
                  <RefreshCw size={16} /> Sincronizar Arquivos
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Footer with Student details */}
      <footer className="app-footer">
        <span>Desktop Entry Editor &copy; 2026. Todos os direitos reservados.</span>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <span>Trabalho Prático - Cursos de Computação</span>
          <span className="footer-dev-info">Aluno: Drew - RA: 12345678</span>
        </div>
      </footer>

      {/* ICON PICKER MODAL */}
      {isIconPickerOpen && (
        <div className="modal-overlay animate-fadeIn" onClick={() => setIsIconPickerOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
            <div className="modal-header">
              <h3>Escolher Ícone</h3>
              <button className="close-btn" onClick={() => setIsIconPickerOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.5rem' }}>&times;</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <div className="search-wrapper" style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  placeholder="Pesquisar ícones por nome..." 
                  value={iconSearchQuery}
                  onChange={(e) => setIconSearchQuery(e.target.value)}
                  className="search-input"
                  autoFocus
                />
                <Search size={16} className="search-icon" style={{ top: '50%', transform: 'translateY(-50%)', margin: 0 }} />
              </div>
              
              <div 
                className="icon-grid" 
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', 
                  gap: '0.75rem', 
                  maxHeight: '350px', 
                  overflowY: 'auto',
                  padding: '0.5rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-primary)'
                }}
              >
                {isSearchingIcons ? (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    Buscando ícones...
                  </div>
                ) : iconPickerResults.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    Nenhum ícone encontrado.
                  </div>
                ) : (
                  iconPickerResults.map(iconName => (
                    <div 
                      key={iconName}
                      className="icon-picker-item"
                      onClick={() => {
                        handleFormChange('icon', iconName);
                        setIsIconPickerOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--accent-color)';
                        e.currentTarget.style.backgroundColor = 'var(--accent-light)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                        e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                      }}
                    >
                      <div style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <AppIcon 
                          icon={iconName} 
                          type="Application" 
                          size={24} 
                          className="entry-icon-image" 
                        />
                      </div>
                      <span 
                        style={{ 
                          fontSize: '0.65rem', 
                          maxWidth: '100%', 
                          textOverflow: 'ellipsis', 
                          whiteSpace: 'nowrap', 
                          overflow: 'hidden',
                          color: 'var(--text-secondary)'
                        }}
                        title={iconName}
                      >
                        {iconName}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
