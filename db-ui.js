// ============================================
// Database UI Functions for Universal CSV Matcher
// ============================================

// ============================================
// TAB NAVIGATION
// ============================================
function switchMainTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    if (tabName === 'matcher') {
        document.getElementById('matcherTab').classList.add('active');
        document.querySelector('.tab-btn[onclick*="matcher"]').classList.add('active');
    } else if (tabName === 'database') {
        document.getElementById('databaseTab').classList.add('active');
        document.querySelector('.tab-btn[onclick*="database"]').classList.add('active');
        loadDatabaseOverview();
    }
}

function switchDBTab(tabName) {
    document.querySelectorAll('.db-sub-content').forEach(content => {
        content.classList.remove('active');
    });

    document.querySelectorAll('.db-sub-tab').forEach(btn => {
        btn.classList.remove('active');
    });

    if (tabName === 'overview') {
        document.getElementById('dbOverview').classList.add('active');
        document.querySelector('.db-sub-tab[onclick*="overview"]').classList.add('active');
        loadDatabaseOverview();
    } else if (tabName === 'manage') {
        document.getElementById('dbManage').classList.add('active');
        document.querySelector('.db-sub-tab[onclick*="manage"]').classList.add('active');
    } else if (tabName === 'backups') {
        document.getElementById('dbBackups').classList.add('active');
        document.querySelector('.db-sub-tab[onclick*="backups"]').classList.add('active');
        loadBackupsList();
    }
}

// ============================================
// DATABASE OVERVIEW
// ============================================
async function loadDatabaseOverview() {
    try {
        const tables = await dbManager.listTables();
        const tableList = document.getElementById('tableList');
        const emptyState = document.getElementById('emptyState');

        if (tables.length === 0) {
            tableList.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        tableList.innerHTML = '';

        for (const table of tables) {
            const stats = await dbManager.getTableStats(table.id);
            const item = document.createElement('div');
            item.className = 'db-table-item';
            item.innerHTML = `
        <div class="db-table-info">
          <div class="db-table-name">${table.tableName}</div>
          <div class="db-table-stats">
            <span>${stats.rowCount} Zeilen</span>
            <span>${stats.columnCount} Spalten</span>
            <span>${stats.sizeFormatted}</span>
            <span>Geändert: ${new Date(stats.lastModified).toLocaleDateString('de-DE')}</span>
          </div>
        </div>
        <div class="db-table-actions">
          <button class="db-action-btn" onclick="viewTable(${table.id})">Anzeigen</button>
          <button class="db-action-btn" onclick="exportTableAsCSV(${table.id})">Exportieren</button>
          <button class="db-action-btn danger" onclick="deleteTableConfirm(${table.id}, '${table.tableName}')">Löschen</button>
        </div>
      `;
            tableList.appendChild(item);
        }
    } catch (error) {
        console.error('Error loading tables:', error);
        showAlert('Fehler beim Laden der Tabellen: ' + error.message, 'error');
    }
}

function filterTables() {
    const searchTerm = document.getElementById('tableSearch').value.toLowerCase();
    const items = document.querySelectorAll('.db-table-item');

    items.forEach(item => {
        const tableName = item.querySelector('.db-table-name').textContent.toLowerCase();
        if (tableName.includes(searchTerm)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// ============================================
// TABLE CREATION - Enhanced CSV Upload
// ============================================
let pendingFiles = [];
let currentPreviewFile = null;
let parsedCSVData = null;

function showCreateTableForm() {
    switchDBTab('manage');
    document.getElementById('createTableForm').style.display = 'block';
    document.getElementById('editTableView').style.display = 'none';
    document.getElementById('manageEmptyState').style.display = 'none';
}

function cancelCreateTable() {
    document.getElementById('createTableForm').style.display = 'none';
    document.getElementById('manageEmptyState').style.display = 'block';
    document.getElementById('newTableName').value = '';
    document.getElementById('dbCSVUpload').value = '';
    document.getElementById('csvOptions').style.display = 'none';
    pendingFiles = [];
    currentPreviewFile = null;
    parsedCSVData = null;
}

async function handleDBCSVUpload(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    pendingFiles = files;
    currentPreviewFile = files[0];

    document.getElementById('csvOptions').style.display = 'block';
    updateCSVPreview();
}

async function updateCSVPreview() {
    if (!currentPreviewFile) return;

    const delimiter = document.getElementById('csvDelimiter').value;
    const encoding = document.getElementById('csvEncoding').value;
    const headerRow = parseInt(document.getElementById('csvHeaderRow').value) - 1;

    try {
        const text = await readFileWithEncoding(currentPreviewFile, encoding);

        Papa.parse(text, {
            delimiter: delimiter,
            skipEmptyLines: true,
            complete: function (results) {
                parsedCSVData = results.data;
                displayCSVPreview(results.data, headerRow);
            },
            error: function (error) {
                showAlert('Fehler beim Parsen der CSV: ' + error.message, 'error');
            }
        });
    } catch (error) {
        showAlert('Fehler beim Lesen der Datei: ' + error.message, 'error');
    }
}

function readFileWithEncoding(file, encoding) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = function (e) {
            resolve(e.target.result);
        };

        reader.onerror = function () {
            reject(new Error('Fehler beim Lesen der Datei'));
        };

        reader.readAsText(file, encoding);
    });
}

function displayCSVPreview(data, headerRow) {
    const container = document.getElementById('csvPreviewContainer');
    const info = document.getElementById('csvPreviewInfo');

    if (!data || data.length === 0) {
        container.innerHTML = '<p class="subtitle">Keine Daten gefunden</p>';
        return;
    }

    const previewRows = Math.min(10, data.length - headerRow - 1);
    const headers = data[headerRow] || data[0];

    let html = '<table style="width:auto;table-layout:auto;"><thead><tr>';
    headers.forEach((header, index) => {
        html += `<th>${header || 'Spalte ' + (index + 1)}</th>`;
    });
    html += '</tr></thead><tbody>';

    for (let i = headerRow + 1; i < Math.min(headerRow + 1 + previewRows, data.length); i++) {
        if (data[i]) {
            html += '<tr>';
            data[i].forEach(cell => {
                html += `<td>${cell == null ? '' : cell}</td>`;
            });
            html += '</tr>';
        }
    }

    html += '</tbody></table>';
    container.innerHTML = html;

    const totalRows = data.length - headerRow - 1;
    const totalCols = headers.length;
    info.textContent = `Zeige ${Math.min(previewRows, totalRows)} von ${totalRows} Zeilen • ${totalCols} Spalten • ${pendingFiles.length} Datei(en)`;
}

async function createNewTable() {
    const tableName = document.getElementById('newTableName').value.trim();

    if (!tableName) {
        showAlert('Bitte gib einen Tabellennamen ein.', 'warning');
        return;
    }

    try {
        if (pendingFiles.length > 0) {
            const delimiter = document.getElementById('csvDelimiter').value;
            const encoding = document.getElementById('csvEncoding').value;
            const headerRow = parseInt(document.getElementById('csvHeaderRow').value) - 1;

            let allData = [];
            let headers = null;

            for (const file of pendingFiles) {
                const fileData = await parseCSVFile(file, delimiter, encoding);

                if (!headers) {
                    headers = fileData[headerRow];
                    allData = fileData.slice(headerRow + 1);
                } else {
                    allData = allData.concat(fileData.slice(headerRow + 1));
                }
            }

            const csvData = [headers, ...allData];
            await dbManager.importCSV(tableName, csvData, false);
            showAlert(`Tabelle "${tableName}" erfolgreich erstellt mit ${allData.length} Zeilen aus ${pendingFiles.length} Datei(en).`, 'success');
        } else {
            await dbManager.createTable(tableName, [], []);
            showAlert(`Leere Tabelle "${tableName}" erfolgreich erstellt.`, 'success');
        }

        cancelCreateTable();
        loadDatabaseOverview();
    } catch (error) {
        console.error('Error creating table:', error);
        showAlert('Fehler beim Erstellen der Tabelle: ' + error.message, 'error');
    }
}

function parseCSVFile(file, delimiter, encoding) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = function (e) {
            const text = e.target.result;

            Papa.parse(text, {
                delimiter: delimiter,
                skipEmptyLines: true,
                complete: function (results) {
                    resolve(results.data);
                },
                error: function (error) {
                    reject(error);
                }
            });
        };

        reader.onerror = function () {
            reject(new Error('Fehler beim Lesen der Datei'));
        };

        reader.readAsText(file, encoding);
    });
}

// ============================================
// TABLE VIEWING & EDITING
// ============================================
let currentTableId = null;
let currentPage = 0;
const rowsPerPage = 50;

async function viewTable(tableId) {
    currentTableId = tableId;
    currentPage = 0;

    switchDBTab('manage');
    document.getElementById('createTableForm').style.display = 'none';
    document.getElementById('editTableView').style.display = 'block';
    document.getElementById('manageEmptyState').style.display = 'none';

    const table = await dbManager.getTableById(tableId);
    document.getElementById('editTableTitle').textContent = `Tabelle: ${table.tableName}`;

    displayTablePage();
}

async function displayTablePage() {
    const table = await dbManager.getTableById(currentTableId);
    const start = currentPage * rowsPerPage;
    const end = start + rowsPerPage;
    const pageData = table.data.slice(start, end);

    let html = '<div class="preview-table"><table style="width:auto;table-layout:auto;"><thead><tr>';
    table.columns.forEach(col => {
        html += `<th>${col}</th>`;
    });
    html += '</tr></thead><tbody>';

    pageData.forEach(row => {
        html += '<tr>';
        row.forEach(cell => {
            html += `<td>${cell == null ? '' : cell}</td>`;
        });
        html += '</tr>';
    });

    html += '</tbody></table></div>';
    document.getElementById('tableDataView').innerHTML = html;

    const totalPages = Math.ceil(table.data.length / rowsPerPage);
    document.getElementById('paginationInfo').textContent =
        `Zeige ${start + 1}-${Math.min(end, table.data.length)} von ${table.data.length} Zeilen`;
    document.getElementById('prevPageBtn').disabled = currentPage === 0;
    document.getElementById('nextPageBtn').disabled = currentPage >= totalPages - 1;
}

function previousPage() {
    if (currentPage > 0) {
        currentPage--;
        displayTablePage();
    }
}

function nextPage() {
    currentPage++;
    displayTablePage();
}

function closeEditTable() {
    currentTableId = null;
    document.getElementById('editTableView').style.display = 'none';
    document.getElementById('manageEmptyState').style.display = 'block';
    document.getElementById('addCSVOptions').style.display = 'none';
    switchDBTab('overview');
}

// ============================================
// ADD CSV TO EXISTING TABLE (Enhanced)
// ============================================
let pendingAddFiles = [];
let currentAddPreviewFile = null;
let parsedAddCSVData = null;

async function handleAddCSVToTable(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0 || !currentTableId) return;

    pendingAddFiles = files;
    currentAddPreviewFile = files[0];

    document.getElementById('addCSVOptions').style.display = 'block';
    updateAddCSVPreview();
}

async function updateAddCSVPreview() {
    if (!currentAddPreviewFile) return;

    const delimiter = document.getElementById('addCSVDelimiter').value;
    const encoding = document.getElementById('addCSVEncoding').value;
    const headerRow = parseInt(document.getElementById('addCSVHeaderRow').value) - 1;

    try {
        const text = await readFileWithEncoding(currentAddPreviewFile, encoding);

        Papa.parse(text, {
            delimiter: delimiter,
            skipEmptyLines: true,
            complete: function (results) {
                parsedAddCSVData = results.data;
                displayAddCSVPreview(results.data, headerRow);
            },
            error: function (error) {
                showAlert('Fehler beim Parsen der CSV: ' + error.message, 'error');
            }
        });
    } catch (error) {
        showAlert('Fehler beim Lesen der Datei: ' + error.message, 'error');
    }
}

function displayAddCSVPreview(data, headerRow) {
    const container = document.getElementById('addCSVPreviewContainer');
    const info = document.getElementById('addCSVPreviewInfo');

    if (!data || data.length === 0) {
        container.innerHTML = '<p class="subtitle">Keine Daten gefunden</p>';
        return;
    }

    const previewRows = Math.min(10, data.length - headerRow - 1);
    const headers = data[headerRow] || data[0];

    let html = '<table style="width:auto;table-layout:auto;"><thead><tr>';
    headers.forEach((header, index) => {
        html += `<th>${header || 'Spalte ' + (index + 1)}</th>`;
    });
    html += '</tr></thead><tbody>';

    for (let i = headerRow + 1; i < Math.min(headerRow + 1 + previewRows, data.length); i++) {
        if (data[i]) {
            html += '<tr>';
            data[i].forEach(cell => {
                html += `<td>${cell == null ? '' : cell}</td>`;
            });
            html += '</tr>';
        }
    }

    html += '</tbody></table>';
    container.innerHTML = html;

    const totalRows = data.length - headerRow - 1;
    const totalCols = headers.length;
    info.textContent = `Zeige ${Math.min(previewRows, totalRows)} von ${totalRows} Zeilen • ${totalCols} Spalten • ${pendingAddFiles.length} Datei(en)`;
}

async function confirmAddCSVToTable() {
    if (!currentTableId || pendingAddFiles.length === 0) return;

    try {
        const delimiter = document.getElementById('addCSVDelimiter').value;
        const encoding = document.getElementById('addCSVEncoding').value;
        const headerRow = parseInt(document.getElementById('addCSVHeaderRow').value) - 1;

        let allData = [];

        for (const file of pendingAddFiles) {
            const fileData = await parseCSVFile(file, delimiter, encoding);
            allData = allData.concat(fileData.slice(headerRow + 1));
        }

        await dbManager.addDataToTable(currentTableId, allData);
        showAlert(`${allData.length} Zeilen aus ${pendingAddFiles.length} Datei(en) hinzugefügt.`, 'success');

        document.getElementById('addCSVToTable').value = '';
        document.getElementById('addCSVOptions').style.display = 'none';
        pendingAddFiles = [];
        currentAddPreviewFile = null;
        parsedAddCSVData = null;

        displayTablePage();
    } catch (error) {
        showAlert('Fehler beim Hinzufügen der Daten: ' + error.message, 'error');
    }
}

async function exportTableAsCSV(tableId) {
    try {
        const csvData = await dbManager.exportTableToCSV(tableId);
        const table = await dbManager.getTableById(tableId);

        const csv = Papa.unparse(csvData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${table.tableName}_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showAlert('Tabelle erfolgreich exportiert.', 'success');
    } catch (error) {
        showAlert('Fehler beim Exportieren: ' + error.message, 'error');
    }
}

async function deleteTableConfirm(tableId, tableName) {
    if (confirm(`Möchtest du die Tabelle "${tableName}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) {
        try {
            await dbManager.deleteTable(tableId);
            showAlert(`Tabelle "${tableName}" erfolgreich gelöscht.`, 'success');
            loadDatabaseOverview();
        } catch (error) {
            showAlert('Fehler beim Löschen: ' + error.message, 'error');
        }
    }
}

// ============================================
// BACKUP MANAGEMENT
// ============================================
async function loadBackupsList() {
    try {
        const backups = await dbManager.listBackups();
        const backupList = document.getElementById('backupList');
        const emptyState = document.getElementById('backupEmptyState');

        if (backups.length === 0) {
            backupList.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        backupList.innerHTML = '';

        backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        backups.forEach(backup => {
            const item = document.createElement('div');
            item.className = 'backup-item';
            item.innerHTML = `
        <div class="backup-info">
          <div class="backup-name">${backup.tableName}</div>
          <div class="backup-details">
            ${new Date(backup.timestamp).toLocaleString('de-DE')} • 
            ${backup.rowCount} Zeilen • 
            ${backup.description || 'Kein Kommentar'}
          </div>
        </div>
        <div class="backup-actions">
          <button class="db-action-btn" onclick="restoreBackupConfirm(${backup.id}, '${backup.tableName}')">Wiederherstellen</button>
          <button class="db-action-btn" onclick="downloadBackup(${backup.id})">Herunterladen</button>
          <button class="db-action-btn danger" onclick="deleteBackupConfirm(${backup.id})">Löschen</button>
        </div>
      `;
            backupList.appendChild(item);
        });
    } catch (error) {
        console.error('Error loading backups:', error);
        showAlert('Fehler beim Laden der Backups: ' + error.message, 'error');
    }
}

async function createManualBackup() {
    const tables = await dbManager.listTables();
    if (tables.length === 0) {
        showAlert('Keine Tabellen zum Sichern vorhanden.', 'warning');
        return;
    }

    const tableName = prompt('Welche Tabelle möchtest du sichern?\n\nVerfügbare Tabellen:\n' +
        tables.map(t => t.tableName).join('\n'));

    if (!tableName) return;

    const table = tables.find(t => t.tableName === tableName);
    if (!table) {
        showAlert('Tabelle nicht gefunden.', 'error');
        return;
    }

    try {
        await dbManager.createBackup(table.id, 'Manuelles Backup');
        showAlert('Backup erfolgreich erstellt.', 'success');
        loadBackupsList();
    } catch (error) {
        showAlert('Fehler beim Erstellen des Backups: ' + error.message, 'error');
    }
}

async function restoreBackupConfirm(backupId, tableName) {
    if (confirm(`Möchtest du das Backup von "${tableName}" wiederherstellen? Dies überschreibt die aktuelle Tabelle.`)) {
        try {
            await dbManager.restoreBackup(backupId);
            showAlert('Backup erfolgreich wiederhergestellt.', 'success');
            loadDatabaseOverview();
        } catch (error) {
            showAlert('Fehler beim Wiederherstellen: ' + error.message, 'error');
        }
    }
}

async function downloadBackup(backupId) {
    try {
        await dbManager.exportBackupToFile(backupId);
        showAlert('Backup erfolgreich heruntergeladen.', 'success');
    } catch (error) {
        showAlert('Fehler beim Herunterladen: ' + error.message, 'error');
    }
}

async function deleteBackupConfirm(backupId) {
    if (confirm('Möchtest du dieses Backup wirklich löschen?')) {
        try {
            await dbManager.deleteBackup(backupId);
            showAlert('Backup erfolgreich gelöscht.', 'success');
            loadBackupsList();
        } catch (error) {
            showAlert('Fehler beim Löschen: ' + error.message, 'error');
        }
    }
}

// ============================================
// INTEGRATION WITH CSV MATCHER
// ============================================
async function saveToDatabase() {
    const tables = await dbManager.listTables();
    const tableName = prompt('In welche Tabelle möchtest du die Daten speichern?\n\n' +
        'Gib einen neuen Namen ein oder wähle eine bestehende Tabelle:\n' +
        (tables.length > 0 ? tables.map(t => t.tableName).join('\n') : 'Keine Tabellen vorhanden'));

    if (!tableName) return;

    try {
        var baseIndex = +document.getElementById('baseCSV').value;
        var base = csvData[baseIndex];
        var baseData = (base.parsedData || []).slice((base.headerRow || 0) + 1);
        const headers = base.parsedData[base.headerRow];
        const csvDataToSave = [headers, ...baseData];

        await dbManager.importCSV(tableName, csvDataToSave, false);
        showAlert(`Daten erfolgreich in Tabelle "${tableName}" gespeichert.`, 'success');
    } catch (error) {
        showAlert('Fehler beim Speichern: ' + error.message, 'error');
    }
}
