// ============================================
// IndexedDB Manager for Universal CSV Matcher
// ============================================

const DB_NAME = 'CSVMatcherDB';
const DB_VERSION = 1;
const TABLES_STORE = 'tables';
const BACKUPS_STORE = 'backups';

class DBManager {
    constructor() {
        this.db = null;
    }

    // Initialize Database
    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create tables store
                if (!db.objectStoreNames.contains(TABLES_STORE)) {
                    const tablesStore = db.createObjectStore(TABLES_STORE, {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    tablesStore.createIndex('tableName', 'tableName', { unique: true });
                    tablesStore.createIndex('lastModified', 'lastModified', { unique: false });
                }

                // Create backups store
                if (!db.objectStoreNames.contains(BACKUPS_STORE)) {
                    const backupsStore = db.createObjectStore(BACKUPS_STORE, {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    backupsStore.createIndex('tableName', 'tableName', { unique: false });
                    backupsStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    // ============================================
    // TABLE OPERATIONS
    // ============================================

    // Create new table
    async createTable(tableName, columns, data = []) {
        const transaction = this.db.transaction([TABLES_STORE], 'readwrite');
        const store = transaction.objectStore(TABLES_STORE);

        const table = {
            tableName: tableName,
            columns: columns,
            data: data,
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            rowCount: data.length
        };

        return new Promise((resolve, reject) => {
            const request = store.add(table);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Get all tables
    async listTables() {
        const transaction = this.db.transaction([TABLES_STORE], 'readonly');
        const store = transaction.objectStore(TABLES_STORE);

        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Get table by name
    async getTableByName(tableName) {
        const transaction = this.db.transaction([TABLES_STORE], 'readonly');
        const store = transaction.objectStore(TABLES_STORE);
        const index = store.index('tableName');

        return new Promise((resolve, reject) => {
            const request = index.get(tableName);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Get table by ID
    async getTableById(id) {
        const transaction = this.db.transaction([TABLES_STORE], 'readonly');
        const store = transaction.objectStore(TABLES_STORE);

        return new Promise((resolve, reject) => {
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Update table
    async updateTable(id, updates) {
        const table = await this.getTableById(id);
        if (!table) throw new Error('Table not found');

        const updatedTable = {
            ...table,
            ...updates,
            lastModified: new Date().toISOString()
        };

        const transaction = this.db.transaction([TABLES_STORE], 'readwrite');
        const store = transaction.objectStore(TABLES_STORE);

        return new Promise((resolve, reject) => {
            const request = store.put(updatedTable);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Delete table
    async deleteTable(id) {
        const transaction = this.db.transaction([TABLES_STORE], 'readwrite');
        const store = transaction.objectStore(TABLES_STORE);

        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // ============================================
    // DATA OPERATIONS
    // ============================================

    // Add data to table
    async addDataToTable(tableId, newData) {
        const table = await this.getTableById(tableId);
        if (!table) throw new Error('Table not found');

        const updatedData = [...table.data, ...newData];
        return this.updateTable(tableId, {
            data: updatedData,
            rowCount: updatedData.length
        });
    }

    // Update row in table
    async updateRow(tableId, rowIndex, rowData) {
        const table = await this.getTableById(tableId);
        if (!table) throw new Error('Table not found');

        const updatedData = [...table.data];
        updatedData[rowIndex] = rowData;

        return this.updateTable(tableId, {
            data: updatedData
        });
    }

    // Delete row from table
    async deleteRow(tableId, rowIndex) {
        const table = await this.getTableById(tableId);
        if (!table) throw new Error('Table not found');

        const updatedData = table.data.filter((_, index) => index !== rowIndex);

        return this.updateTable(tableId, {
            data: updatedData,
            rowCount: updatedData.length
        });
    }

    // ============================================
    // CSV IMPORT/EXPORT
    // ============================================

    // Import CSV data to new or existing table
    async importCSV(tableName, csvData, append = false) {
        if (!csvData || csvData.length === 0) {
            throw new Error('No data to import');
        }

        const columns = csvData[0]; // First row is headers
        const data = csvData.slice(1); // Rest is data

        if (append) {
            const existingTable = await this.getTableByName(tableName);
            if (existingTable) {
                return this.addDataToTable(existingTable.id, data);
            }
        }

        return this.createTable(tableName, columns, data);
    }

    // Export table to CSV format
    async exportTableToCSV(tableId) {
        const table = await this.getTableById(tableId);
        if (!table) throw new Error('Table not found');

        const csvData = [table.columns, ...table.data];
        return csvData;
    }

    // ============================================
    // BACKUP OPERATIONS
    // ============================================

    // Create backup
    async createBackup(tableId, description = '') {
        const table = await this.getTableById(tableId);
        if (!table) throw new Error('Table not found');

        const backup = {
            tableName: table.tableName,
            tableId: tableId,
            timestamp: new Date().toISOString(),
            description: description,
            version: '1.0',
            rowCount: table.rowCount,
            columns: table.columns,
            data: table.data
        };

        const transaction = this.db.transaction([BACKUPS_STORE], 'readwrite');
        const store = transaction.objectStore(BACKUPS_STORE);

        return new Promise((resolve, reject) => {
            const request = store.add(backup);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // List all backups
    async listBackups(tableName = null) {
        const transaction = this.db.transaction([BACKUPS_STORE], 'readonly');
        const store = transaction.objectStore(BACKUPS_STORE);

        if (tableName) {
            const index = store.index('tableName');
            return new Promise((resolve, reject) => {
                const request = index.getAll(tableName);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }

        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Restore backup
    async restoreBackup(backupId) {
        const transaction = this.db.transaction([BACKUPS_STORE], 'readonly');
        const store = transaction.objectStore(BACKUPS_STORE);

        const backup = await new Promise((resolve, reject) => {
            const request = store.get(backupId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        if (!backup) throw new Error('Backup not found');

        // Check if table exists
        const existingTable = await this.getTableByName(backup.tableName);

        if (existingTable) {
            // Update existing table
            return this.updateTable(existingTable.id, {
                columns: backup.columns,
                data: backup.data,
                rowCount: backup.rowCount
            });
        } else {
            // Create new table
            return this.createTable(backup.tableName, backup.columns, backup.data);
        }
    }

    // Delete backup
    async deleteBackup(backupId) {
        const transaction = this.db.transaction([BACKUPS_STORE], 'readwrite');
        const store = transaction.objectStore(BACKUPS_STORE);

        return new Promise((resolve, reject) => {
            const request = store.delete(backupId);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Export backup to file
    async exportBackupToFile(backupId) {
        const transaction = this.db.transaction([BACKUPS_STORE], 'readonly');
        const store = transaction.objectStore(BACKUPS_STORE);

        const backup = await new Promise((resolve, reject) => {
            const request = store.get(backupId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        if (!backup) throw new Error('Backup not found');

        const blob = new Blob([JSON.stringify(backup, null, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_${backup.tableName}_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================

    // Get table statistics
    async getTableStats(tableId) {
        const table = await this.getTableById(tableId);
        if (!table) throw new Error('Table not found');

        const dataSize = new Blob([JSON.stringify(table.data)]).size;

        return {
            name: table.tableName,
            rowCount: table.rowCount,
            columnCount: table.columns.length,
            sizeBytes: dataSize,
            sizeFormatted: this.formatBytes(dataSize),
            createdAt: table.createdAt,
            lastModified: table.lastModified
        };
    }

    // Format bytes to human-readable
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    // Auto-backup scheduler
    async scheduleAutoBackup(tableId, intervalHours = 24) {
        const backup = async () => {
            try {
                await this.createBackup(tableId, 'Auto-backup');
                console.log(`Auto-backup created for table ${tableId}`);

                // Clean old backups (keep last 7)
                const backups = await this.listBackups();
                const tableBackups = backups
                    .filter(b => b.tableId === tableId)
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

                if (tableBackups.length > 7) {
                    for (let i = 7; i < tableBackups.length; i++) {
                        await this.deleteBackup(tableBackups[i].id);
                    }
                }
            } catch (error) {
                console.error('Auto-backup failed:', error);
            }
        };

        // Run immediately
        await backup();

        // Schedule recurring backup
        setInterval(backup, intervalHours * 60 * 60 * 1000);
    }
}

// Create global instance
const dbManager = new DBManager();

// Initialize on load
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', async () => {
        try {
            await dbManager.initDB();
            console.log('IndexedDB initialized successfully');
        } catch (error) {
            console.error('Failed to initialize IndexedDB:', error);
        }
    });
}
