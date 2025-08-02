// TOTP Authenticator App
class TOTPAuthenticator {
    constructor() {
        this.keys = [];
        this.timers = new Map();
        this.isEditing = false;
        this.editingId = null;
        this.isDarkMode = localStorage.getItem('darkMode') === 'true';
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.initTheme();
        await this.loadKeys();
        this.startGlobalTimer();
    }

    setupEventListeners() {
        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());

        // Modal controls
        document.getElementById('addKeyBtn').addEventListener('click', () => this.showModal());
        document.getElementById('closeModal').addEventListener('click', () => this.hideModal());
        document.getElementById('cancelBtn').addEventListener('click', () => this.hideModal());
        
        // Export/Import buttons
        document.getElementById('exportBtn').addEventListener('click', () => this.showExportModal());
        document.getElementById('importBtn').addEventListener('click', () => this.showImportModal());
        
        // Export modal controls
        document.getElementById('closeExportModal').addEventListener('click', () => this.hideExportModal());
        document.getElementById('downloadQRBtn').addEventListener('click', () => this.downloadQRCode());
        document.getElementById('copyExportUrlBtn').addEventListener('click', () => this.copyExportUrl());
        document.getElementById('downloadJsonBtn').addEventListener('click', () => this.downloadJsonBackup());
        
        // Import modal controls
        document.getElementById('closeImportModal').addEventListener('click', () => this.hideImportModal());
        document.getElementById('importUrlTab').addEventListener('click', () => this.switchImportTab('url'));
        document.getElementById('importFileTab').addEventListener('click', () => this.switchImportTab('file'));
        document.getElementById('parseUrlBtn').addEventListener('click', () => this.parseImportUrl());
        document.getElementById('parseFileBtn').addEventListener('click', () => this.parseImportFile());
        document.getElementById('confirmImportBtn').addEventListener('click', () => this.confirmImport());
        document.getElementById('cancelImportBtn').addEventListener('click', () => this.cancelImport());
        document.getElementById('clearUrlBtn').addEventListener('click', () => this.clearUrlInput());
        document.getElementById('clearFileBtn').addEventListener('click', () => this.clearFileInput());
        document.getElementById('selectAllBtn').addEventListener('click', () => this.selectAllKeys());
        document.getElementById('selectNoneBtn').addEventListener('click', () => this.selectNoneKeys());
        
        // File input handling
        document.getElementById('importFile').addEventListener('change', (e) => this.handleFileSelect(e));
        
        // URL input handling
        document.getElementById('importUrl').addEventListener('input', (e) => this.handleUrlInput(e));
        
        // Form submission
        document.getElementById('keyForm').addEventListener('submit', (e) => this.handleFormSubmit(e));
        
        // Click outside modal to close
        document.getElementById('addKeyModal').addEventListener('click', (e) => {
            if (e.target.id === 'addKeyModal') {
                this.hideModal();
            }
        });

        document.getElementById('exportModal').addEventListener('click', (e) => {
            if (e.target.id === 'exportModal') {
                this.hideExportModal();
            }
        });

        document.getElementById('importModal').addEventListener('click', (e) => {
            if (e.target.id === 'importModal') {
                this.hideImportModal();
            }
        });

        // Escape key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (document.getElementById('addKeyModal').classList.contains('show')) {
                    this.hideModal();
                } else if (document.getElementById('exportModal').classList.contains('show')) {
                    this.hideExportModal();
                } else if (document.getElementById('importModal').classList.contains('show')) {
                    this.hideImportModal();
                }
            }
        });
    }

    showModal(editKey = null) {
        const modal = document.getElementById('addKeyModal');
        const title = document.getElementById('modalTitle');
        const form = document.getElementById('keyForm');
        
        if (editKey) {
            this.isEditing = true;
            this.editingId = editKey.id;
            title.textContent = 'Edit TOTP Key';
            document.getElementById('keyName').value = editKey.name;
            document.getElementById('keyAccount').value = editKey.account || '';
            document.getElementById('keySecret').value = editKey.secret;
            document.getElementById('saveBtn').textContent = 'Update';
        } else {
            this.isEditing = false;
            this.editingId = null;
            title.textContent = 'Add New TOTP Key';
            form.reset();
            document.getElementById('saveBtn').textContent = 'Save';
        }
        
        modal.classList.add('show');
        document.getElementById('keyName').focus();
    }

    hideModal() {
        const modal = document.getElementById('addKeyModal');
        modal.classList.remove('show');
        this.isEditing = false;
        this.editingId = null;
    }

    async handleFormSubmit(e) {
        e.preventDefault();
        
        const name = document.getElementById('keyName').value.trim();
        const account = document.getElementById('keyAccount').value.trim();
        // Allow users to paste secrets with spaces or lowercase letters
        const rawSecret = document.getElementById('keySecret').value.trim();
        const secret = rawSecret.replace(/\s+/g, '').toUpperCase();
        
        if (!name || !secret) {
            this.showToast('Please fill in all required fields', 'error');
            return;
        }

        // Validate secret key format (Base32)
        if (!this.isValidBase32(secret)) {
            this.showToast('Invalid secret key format. Please enter a valid Base32 key.', 'error');
            return;
        }

        try {
            const keyData = {
                name,
                account,
                secret: secret.toUpperCase(),
                createdAt: new Date().toISOString()
            };

            if (this.isEditing) {
                await this.updateKey(this.editingId, keyData);
                this.showToast('Key updated successfully', 'success');
            } else {
                await this.addKey(keyData);
                this.showToast('Key added successfully', 'success');
            }

            this.hideModal();
            await this.loadKeys();
        } catch (error) {
            console.error('Error saving key:', error);
            this.showToast('Failed to save key. Please try again.', 'error');
        }
    }

    isValidBase32(str) {
        // Base32 alphabet: A-Z (26 letters) + 2-7 (6 numbers) + optional padding =
        const base32Regex = /^[A-Z2-7]+=*$/;
        const isValidFormat = base32Regex.test(str);
        const isValidLength = str.length >= 16;
        
        console.log('Base32 validation:', {
            secret: str.substring(0, 8) + '...',
            format: isValidFormat,
            length: isValidLength,
            actualLength: str.length
        });
        
        return isValidFormat && isValidLength;
    }

    async addKey(keyData) {
        if (!window.db) {
            throw new Error('Firebase not initialized');
        }

        const { addDoc, collection } = await import('https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js');
        
        const docRef = await addDoc(collection(window.db, 'totpKeys'), keyData);
        return docRef.id;
    }

    async updateKey(id, keyData) {
        if (!window.db) {
            throw new Error('Firebase not initialized');
        }

        const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js');
        
        const keyRef = doc(window.db, 'totpKeys', id);
        await updateDoc(keyRef, {
            ...keyData,
            updatedAt: new Date().toISOString()
        });
    }

    async deleteKey(id) {
        if (!window.db) {
            throw new Error('Firebase not initialized');
        }

        if (!confirm('Are you sure you want to delete this key?')) {
            return;
        }

        try {
            const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js');
            
            const keyRef = doc(window.db, 'totpKeys', id);
            await deleteDoc(keyRef);
            
            this.showToast('Key deleted successfully', 'success');
            await this.loadKeys();
        } catch (error) {
            console.error('Error deleting key:', error);
            this.showToast('Failed to delete key. Please try again.', 'error');
        }
    }

    async loadKeys() {
        const loadingState = document.getElementById('loadingState');
        const emptyState = document.getElementById('emptyState');
        const keysList = document.getElementById('keysList');

        loadingState.style.display = 'block';
        emptyState.style.display = 'none';
        keysList.innerHTML = '';

        try {
            if (!window.db) {
                throw new Error('Firebase not initialized');
            }

            const { collection, getDocs, orderBy, query } = await import('https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js');
            
            const q = query(collection(window.db, 'totpKeys'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            
            this.keys = [];
            querySnapshot.forEach((doc) => {
                this.keys.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            loadingState.style.display = 'none';

            if (this.keys.length === 0) {
                emptyState.style.display = 'block';
            } else {
                this.renderKeys();
            }
        } catch (error) {
            console.error('Error loading keys:', error);
            loadingState.style.display = 'none';
            this.showToast('Failed to load keys. Please check your Firebase configuration.', 'error');
        }
    }

    renderKeys() {
        const keysList = document.getElementById('keysList');
        keysList.innerHTML = '';

        this.keys.forEach(key => {
            const keyCard = this.createKeyCard(key);
            keysList.appendChild(keyCard);
        });

        // Generate initial TOTP codes
        this.updateAllTOTPCodes();
    }

    createKeyCard(key) {
        const card = document.createElement('div');
        card.className = 'key-card';
        card.innerHTML = `
            <div class="key-header">
                <div class="key-info">
                    <h3>${this.escapeHtml(key.name)}</h3>
                    ${key.account ? `<p>${this.escapeHtml(key.account)}</p>` : ''}
                </div>
                <div class="key-actions">
                    <button class="btn-icon" onclick="app.editKey('${key.id}')" title="Edit" aria-label="Edit key">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="btn-icon btn-danger" onclick="app.deleteKey('${key.id}')" title="Delete" aria-label="Delete key">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3,6 5,6 21,6"/>
                            <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                            <line x1="10" y1="11" x2="10" y2="17"/>
                            <line x1="14" y1="11" x2="14" y2="17"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="totp-display">
                <div class="totp-code" id="code-${key.id}" onclick="app.copyToClipboard('${key.id}')">
                    ------
                </div>
                <div class="totp-timer">
                    <div class="timer-circle">
                        <div class="timer-fill" id="timer-${key.id}"></div>
                    </div>
                    <span id="countdown-${key.id}">30s</span>
                </div>
            </div>
        `;
        return card;
    }

    editKey(id) {
        const key = this.keys.find(k => k.id === id);
        if (key) {
            this.showModal(key);
        }
    }

    generateTOTP(secret) {
        try {
            // Ensure secret is properly formatted Base32
            const cleanSecret = secret.replace(/\s+/g, '').toUpperCase();
            
            // Validate Base32 format before generating
            if (!this.isValidBase32(cleanSecret)) {
                console.error('Invalid Base32 secret:', secret);
                return '------';
            }
            
            // Create TOTP instance using OTPAuth
            const totp = new window.OTPAuth.TOTP({
                secret: cleanSecret,
                algorithm: 'SHA1',
                digits: 6,
                period: 30
            });
            
            // Generate TOTP code
            const code = totp.generate();
            console.log('Generated TOTP code for secret:', cleanSecret.substring(0, 4) + '...', 'Code:', code);
            return code;
        } catch (error) {
            console.error('Error generating TOTP:', error, 'Secret:', secret);
            return '------';
        }
    }

    updateAllTOTPCodes() {
        console.log('Updating TOTP codes for', this.keys.length, 'keys');
        this.keys.forEach(key => {
            const code = this.generateTOTP(key.secret);
            const codeElement = document.getElementById(`code-${key.id}`);
            if (codeElement) {
                // Format code with spaces for better readability
                const formattedCode = code.replace(/(\d{3})/g, '$1 ').trim();
                codeElement.textContent = formattedCode;
                console.log('Updated code element for key:', key.name, 'Code:', formattedCode);
            } else {
                console.error('Code element not found for key:', key.id, key.name);
            }
        });
    }

    startGlobalTimer() {
        const updateTimer = () => {
            const now = Math.floor(Date.now() / 1000);
            const timeLeft = 30 - (now % 30);
            const progress = (30 - timeLeft) / 30;

            // Update all countdown displays
            this.keys.forEach(key => {
                const countdownElement = document.getElementById(`countdown-${key.id}`);
                const timerFillElement = document.getElementById(`timer-${key.id}`);
                
                if (countdownElement) {
                    countdownElement.textContent = `${timeLeft}s`;
                }
                
                if (timerFillElement) {
                    const rotation = progress * 360;
                    timerFillElement.style.transform = `rotate(${rotation}deg)`;
                    
                    // Change color based on time left
                    timerFillElement.className = 'timer-fill';
                    if (timeLeft <= 5) {
                        timerFillElement.classList.add('danger');
                    } else if (timeLeft <= 10) {
                        timerFillElement.classList.add('warning');
                    }
                }
            });

            // Generate new codes when timer resets
            if (timeLeft === 30) {
                this.updateAllTOTPCodes();
            }
        };

        // Update immediately and then every second
        updateTimer();
        setInterval(updateTimer, 1000);
    }

    async copyToClipboard(keyId) {
        const codeElement = document.getElementById(`code-${keyId}`);
        if (!codeElement) return;

        const code = codeElement.textContent.replace(/\s/g, '');
        
        try {
            await navigator.clipboard.writeText(code);
            
            // Visual feedback
            codeElement.classList.add('copied');
            setTimeout(() => {
                codeElement.classList.remove('copied');
            }, 1000);
            
            this.showToast('Code copied to clipboard', 'success');
        } catch (error) {
            console.error('Failed to copy:', error);
            this.showToast('Failed to copy code', 'error');
        }
    }

    showToast(message, type = 'info') {
        const toastId = type === 'error' ? 'errorToast' : 'successToast';
        const messageId = type === 'error' ? 'errorMessage' : 'successMessage';
        
        const toast = document.getElementById(toastId);
        const messageElement = document.getElementById(messageId);
        
        messageElement.textContent = message;
        toast.classList.add('show');
        
        // Auto hide after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    initTheme() {
        if (this.isDarkMode) {
            document.documentElement.setAttribute('data-theme', 'dark');
            document.getElementById('themeToggle').textContent = '☀️';
        } else {
            document.documentElement.removeAttribute('data-theme');
            document.getElementById('themeToggle').textContent = '🌙';
        }
    }

    toggleTheme() {
        this.isDarkMode = !this.isDarkMode;
        localStorage.setItem('darkMode', this.isDarkMode);
        this.initTheme();
    }

    // Export Modal Management
    showExportModal() {
        const modal = document.getElementById('exportModal');
        modal.classList.add('show');
        this.generateExportQR();
    }

    hideExportModal() {
        const modal = document.getElementById('exportModal');
        modal.classList.remove('show');
    }

    // Import Modal Management
    showImportModal() {
        const modal = document.getElementById('importModal');
        modal.classList.add('show');
        this.resetImportModal();
    }

    hideImportModal() {
        const modal = document.getElementById('importModal');
        modal.classList.remove('show');
        this.resetImportModal();
    }

    switchImportTab(tab) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        if (tab === 'url') {
            document.getElementById('importUrlTab').classList.add('active');
            document.getElementById('importUrlContent').classList.add('active');
        } else {
            document.getElementById('importFileTab').classList.add('active');
            document.getElementById('importFileContent').classList.add('active');
        }
    }

    resetImportModal() {
        // Reset form inputs
        document.getElementById('importUrl').value = '';
        document.getElementById('importFile').value = '';
        document.getElementById('fileInputLabel').textContent = 'Choose backup file';
        
        // Reset file input container
        const fileContainer = document.querySelector('.file-input-container');
        fileContainer.classList.remove('has-file');
        
        // Hide all states
        document.getElementById('importPreview').style.display = 'none';
        document.getElementById('importLoading').style.display = 'none';
        document.getElementById('importSuccess').style.display = 'none';
        
        // Hide clear buttons
        document.getElementById('clearUrlBtn').style.display = 'none';
        document.getElementById('clearFileBtn').style.display = 'none';
        
        // Reset button states
        document.getElementById('parseFileBtn').disabled = true;
        
        // Reset to URL tab
        this.switchImportTab('url');
        
        // Clear any stored import data
        this.pendingImportKeys = [];
    }

    clearUrlInput() {
        document.getElementById('importUrl').value = '';
        document.getElementById('clearUrlBtn').style.display = 'none';
        document.getElementById('importPreview').style.display = 'none';
    }

    clearFileInput() {
        document.getElementById('importFile').value = '';
        document.getElementById('fileInputLabel').textContent = 'Choose backup file';
        document.getElementById('clearFileBtn').style.display = 'none';
        document.getElementById('parseFileBtn').disabled = true;
        
        const fileContainer = document.querySelector('.file-input-container');
        fileContainer.classList.remove('has-file');
        document.getElementById('importPreview').style.display = 'none';
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        const label = document.getElementById('fileInputLabel');
        const parseBtn = document.getElementById('parseFileBtn');
        const clearBtn = document.getElementById('clearFileBtn');
        const fileContainer = document.querySelector('.file-input-container');
        
        if (file) {
            label.textContent = file.name;
            parseBtn.disabled = false;
            clearBtn.style.display = 'inline-flex';
            fileContainer.classList.add('has-file');
        } else {
            label.textContent = 'Choose backup file';
            parseBtn.disabled = true;
            clearBtn.style.display = 'none';
            fileContainer.classList.remove('has-file');
        }
    }

    selectAllKeys() {
        const checkboxes = document.querySelectorAll('#importKeysList input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = true);
    }

    selectNoneKeys() {
        const checkboxes = document.querySelectorAll('#importKeysList input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = false);
    }

    handleUrlInput(event) {
        const url = event.target.value.trim();
        const clearBtn = document.getElementById('clearUrlBtn');
        
        if (url) {
            clearBtn.style.display = 'inline-flex';
        } else {
            clearBtn.style.display = 'none';
            document.getElementById('importPreview').style.display = 'none';
        }
    }

    // Export Functionality
    async generateExportQR() {
        const loadingEl = document.getElementById('exportLoading');
        const successEl = document.getElementById('exportSuccess');
        
        loadingEl.style.display = 'block';
        successEl.style.display = 'none';

        try {
            if (this.keys.length === 0) {
                this.showToast('No keys to export', 'error');
                this.hideExportModal();
                return;
            }

            // Create Google Authenticator migration URL
            const migrationUrl = await this.createMigrationUrl();
            
            // Generate QR code
            const canvas = document.getElementById('exportQRCode');
            await QRCode.toCanvas(canvas, migrationUrl, {
                width: 256,
                margin: 2,
                color: {
                    dark: getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim() || '#000000',
                    light: getComputedStyle(document.documentElement).getPropertyValue('--card-bg').trim() || '#FFFFFF'
                }
            });

            // Set export URL in textarea
            document.getElementById('exportUrlText').value = migrationUrl;
            
            loadingEl.style.display = 'none';
            successEl.style.display = 'block';
            
            this.currentExportUrl = migrationUrl;
            
        } catch (error) {
            console.error('Error generating export QR:', error);
            this.showToast('Failed to generate export QR code', 'error');
            loadingEl.style.display = 'none';
            this.hideExportModal();
        }
    }

    async createMigrationUrl() {
        // Create protobuf payload for Google Authenticator
        const migrationPayload = {
            otpParameters: this.keys.map(key => ({
                secret: this.base32ToUint8Array(key.secret),
                name: key.account || key.name,
                issuer: key.name,
                algorithm: 1, // SHA1
                digits: 6,
                type: 2, // TOTP
                counter: 0
            })),
            version: 1,
            batchSize: this.keys.length,
            batchIndex: 0,
            batchId: Math.floor(Math.random() * 1000000)
        };

        // Create protobuf message using protobufjs
        const root = await protobuf.parse(`
            syntax = "proto3";
            message MigrationPayload {
                repeated OtpParameters otp_parameters = 1;
                int32 version = 2;
                int32 batch_size = 3;
                int32 batch_index = 4;
                int32 batch_id = 5;
            }
            message OtpParameters {
                bytes secret = 1;
                string name = 2;
                string issuer = 3;
                Algorithm algorithm = 4;
                DigitCount digits = 5;
                OtpType type = 6;
                int64 counter = 7;
            }
            enum Algorithm {
                ALGORITHM_UNSPECIFIED = 0;
                ALGORITHM_SHA1 = 1;
                ALGORITHM_SHA256 = 2;
                ALGORITHM_SHA512 = 3;
                ALGORITHM_MD5 = 4;
            }
            enum DigitCount {
                DIGIT_COUNT_UNSPECIFIED = 0;
                DIGIT_COUNT_SIX = 1;
                DIGIT_COUNT_EIGHT = 2;
            }
            enum OtpType {
                OTP_TYPE_UNSPECIFIED = 0;
                OTP_TYPE_HOTP = 1;
                OTP_TYPE_TOTP = 2;
            }
        `).root;

        const MigrationPayload = root.lookupType('MigrationPayload');
        
        // Encode the payload
        const message = MigrationPayload.create(migrationPayload);
        const buffer = MigrationPayload.encode(message).finish();
        
        // Convert to base64url
        const base64 = btoa(String.fromCharCode.apply(null, buffer));
        const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
        
        return `otpauth-migration://offline?data=${base64url}`;
    }

    base32ToUint8Array(base32) {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        let bits = '';
        let result = new Uint8Array(Math.floor(base32.length * 5 / 8));
        
        // Convert base32 to bit string
        for (let i = 0; i < base32.length; i++) {
            const val = alphabet.indexOf(base32[i]);
            if (val === -1) continue;
            bits += val.toString(2).padStart(5, '0');
        }
        
        // Convert bit string to bytes
        for (let i = 0; i < result.length; i++) {
            const byteStr = bits.substr(i * 8, 8);
            if (byteStr.length === 8) {
                result[i] = parseInt(byteStr, 2);
            }
        }
        
        return result;
    }

    downloadQRCode() {
        const canvas = document.getElementById('exportQRCode');
        const link = document.createElement('a');
        link.download = `TOTP-Export-${new Date().getTime()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        this.showToast('QR code downloaded', 'success');
    }

    async copyExportUrl() {
        try {
            await navigator.clipboard.writeText(this.currentExportUrl);
            this.showToast('Export URL copied to clipboard', 'success');
        } catch (error) {
            console.error('Failed to copy URL:', error);
            this.showToast('Failed to copy URL', 'error');
        }
    }

    downloadJsonBackup() {
        const exportData = this.keys.map(key => ({
            name: key.name,
            account: key.account || '',
            secret: key.secret,
            createdAt: key.createdAt
        }));

        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.download = `TOTP-Backup-${new Date().toISOString().split('T')[0]}.json`;
        link.href = url;
        link.click();
        
        URL.revokeObjectURL(url);
        this.showToast('JSON backup downloaded', 'success');
    }

    // Import Functionality
    async parseImportUrl() {
        const url = document.getElementById('importUrl').value.trim();
        const loadingEl = document.getElementById('importLoading');
        const loadingText = document.getElementById('importLoadingText');
        
        if (!url) {
            this.showToast('Please enter a migration URL', 'error');
            return;
        }

        if (!url.startsWith('otpauth-migration://')) {
            this.showToast('Invalid migration URL format. URL should start with "otpauth-migration://"', 'error');
            return;
        }

        // Show loading state
        loadingEl.style.display = 'block';
        loadingText.textContent = 'Parsing migration URL...';
        document.getElementById('clearUrlBtn').style.display = 'inline-flex';

        try {
            const urlObj = new URL(url);
            const data = urlObj.searchParams.get('data');
            
            if (!data) {
                this.showToast('No data found in migration URL', 'error');
                loadingEl.style.display = 'none';
                return;
            }

            loadingText.textContent = 'Decoding TOTP keys...';
            const keys = await this.decodeMigrationData(data);
            
            if (keys.length === 0) {
                this.showToast('No TOTP keys found in migration URL', 'error');
                loadingEl.style.display = 'none';
                return;
            }
            
            loadingEl.style.display = 'none';
            this.showImportPreview(keys);
            
        } catch (error) {
            console.error('Error parsing migration URL:', error);
            loadingEl.style.display = 'none';
            this.showToast('Failed to parse migration URL. Please check the URL format.', 'error');
        }
    }

    async parseImportFile() {
        const fileInput = document.getElementById('importFile');
        const file = fileInput.files[0];
        const loadingEl = document.getElementById('importLoading');
        const loadingText = document.getElementById('importLoadingText');
        
        if (!file) {
            this.showToast('Please select a file', 'error');
            return;
        }

        // Show loading state
        loadingEl.style.display = 'block';
        loadingText.textContent = 'Reading backup file...';

        try {
            loadingText.textContent = 'Parsing backup data...';
            const text = await file.text();
            const data = JSON.parse(text);
            
            // Validate JSON structure
            if (!Array.isArray(data)) {
                this.showToast('Invalid backup file format: Expected an array of keys', 'error');
                loadingEl.style.display = 'none';
                return;
            }

            const validKeys = data.filter(key => key.name && key.secret);
            
            if (validKeys.length === 0) {
                this.showToast('No valid TOTP keys found in backup file', 'error');
                loadingEl.style.display = 'none';
                return;
            }

            if (validKeys.length < data.length) {
                this.showToast(`Found ${validKeys.length} valid keys out of ${data.length} entries`, 'info');
            }
            
            loadingEl.style.display = 'none';
            this.showImportPreview(validKeys);
            
        } catch (error) {
            console.error('Error parsing import file:', error);
            loadingEl.style.display = 'none';
            
            if (error instanceof SyntaxError) {
                this.showToast('Invalid JSON file format. Please select a valid backup file.', 'error');
            } else {
                this.showToast('Failed to parse backup file', 'error');
            }
        }
    }

    async decodeMigrationData(base64Data) {
        try {
            // Convert base64url to base64
            let base64 = base64Data.replace(/-/g, '+').replace(/_/g, '/');
            
            // Add padding if needed
            while (base64.length % 4) {
                base64 += '=';
            }
            
            // Decode base64 to binary
            const binaryString = atob(base64);
            const buffer = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                buffer[i] = binaryString.charCodeAt(i);
            }

            // Parse protobuf
            const root = await protobuf.parse(`
                syntax = "proto3";
                message MigrationPayload {
                    repeated OtpParameters otp_parameters = 1;
                    int32 version = 2;
                    int32 batch_size = 3;
                    int32 batch_index = 4;
                    int32 batch_id = 5;
                }
                message OtpParameters {
                    bytes secret = 1;
                    string name = 2;
                    string issuer = 3;
                    Algorithm algorithm = 4;
                    DigitCount digits = 5;
                    OtpType type = 6;
                    int64 counter = 7;
                }
                enum Algorithm {
                    ALGORITHM_UNSPECIFIED = 0;
                    ALGORITHM_SHA1 = 1;
                    ALGORITHM_SHA256 = 2;
                    ALGORITHM_SHA512 = 3;
                    ALGORITHM_MD5 = 4;
                }
                enum DigitCount {
                    DIGIT_COUNT_UNSPECIFIED = 0;
                    DIGIT_COUNT_SIX = 1;
                    DIGIT_COUNT_EIGHT = 2;
                }
                enum OtpType {
                    OTP_TYPE_UNSPECIFIED = 0;
                    OTP_TYPE_HOTP = 1;
                    OTP_TYPE_TOTP = 2;
                }
            `).root;

            const MigrationPayload = root.lookupType('MigrationPayload');
            const message = MigrationPayload.decode(buffer);
            
            // Convert to our format
            const keys = message.otpParameters
                .filter(param => param.type === 2) // Only TOTP
                .map(param => ({
                    name: param.issuer || 'Unknown Service',
                    account: param.name || '',
                    secret: this.uint8ArrayToBase32(param.secret),
                    createdAt: new Date().toISOString()
                }));

            return keys;
            
        } catch (error) {
            console.error('Error decoding migration data:', error);
            throw new Error('Failed to decode migration data');
        }
    }

    uint8ArrayToBase32(buffer) {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        let bits = '';
        let result = '';
        
        // Convert bytes to bit string
        for (let i = 0; i < buffer.length; i++) {
            bits += buffer[i].toString(2).padStart(8, '0');
        }
        
        // Convert bit string to base32
        for (let i = 0; i < bits.length; i += 5) {
            const chunk = bits.substr(i, 5);
            if (chunk.length === 5) {
                result += alphabet[parseInt(chunk, 2)];
            }
        }
        
        return result;
    }

    showImportPreview(keys) {
        this.pendingImportKeys = keys;
        
        const previewEl = document.getElementById('importPreview');
        const listEl = document.getElementById('importKeysList');
        const countEl = document.getElementById('importCount');
        
        // Update count
        countEl.textContent = keys.length;
        
        // Clear and populate list
        listEl.innerHTML = '';
        
        keys.forEach((key, index) => {
            // Check if key already exists
            const exists = this.keys.some(existingKey => 
                existingKey.name === key.name && existingKey.account === (key.account || '')
            );
            
            const item = document.createElement('div');
            item.className = 'import-key-item';
            item.innerHTML = `
                <div class="import-key-info">
                    <h4>${this.escapeHtml(key.name)}${exists ? ' <span style="color: orange; font-size: 0.8em;">(exists)</span>' : ''}</h4>
                    <p>${this.escapeHtml(key.account || 'No account specified')}</p>
                </div>
                <input type="checkbox" ${exists ? '' : 'checked'} data-index="${index}" ${exists ? 'title="This key already exists"' : ''}>
            `;
            listEl.appendChild(item);
        });
        
        previewEl.style.display = 'block';
    }

    async confirmImport() {
        const loadingEl = document.getElementById('importLoading');
        const loadingText = document.getElementById('importLoadingText');
        const previewEl = document.getElementById('importPreview');
        const successEl = document.getElementById('importSuccess');
        const successText = document.getElementById('importResultText');
        
        // Get selected keys
        const checkboxes = document.querySelectorAll('#importKeysList input[type="checkbox"]:checked');
        const selectedKeys = Array.from(checkboxes).map(cb => 
            this.pendingImportKeys[parseInt(cb.dataset.index)]
        );

        if (selectedKeys.length === 0) {
            this.showToast('No keys selected for import', 'error');
            return;
        }

        // Show loading state
        previewEl.style.display = 'none';
        loadingEl.style.display = 'block';
        loadingText.textContent = `Importing ${selectedKeys.length} key(s)...`;

        try {
            // Import selected keys
            let importedCount = 0;
            let skippedCount = 0;
            let errorCount = 0;
            
            for (let i = 0; i < selectedKeys.length; i++) {
                const key = selectedKeys[i];
                loadingText.textContent = `Importing key ${i + 1} of ${selectedKeys.length}: ${key.name}`;
                
                try {
                    // Check if key already exists
                    const exists = this.keys.some(existingKey => 
                        existingKey.name === key.name && existingKey.account === (key.account || '')
                    );
                    
                    if (!exists) {
                        await this.addKey(key);
                        importedCount++;
                    } else {
                        skippedCount++;
                    }
                } catch (error) {
                    console.error('Error importing key:', key.name, error);
                    errorCount++;
                }
            }

            loadingEl.style.display = 'none';
            
            // Show success state
            if (importedCount > 0) {
                await this.loadKeys();
                successText.textContent = `Successfully imported ${importedCount} key(s).`;
                if (skippedCount > 0) {
                    successText.textContent += ` Skipped ${skippedCount} duplicate(s).`;
                }
                if (errorCount > 0) {
                    successText.textContent += ` ${errorCount} error(s) occurred.`;
                }
                
                successEl.style.display = 'block';
                
                // Auto-close after 3 seconds
                setTimeout(() => {
                    this.hideImportModal();
                }, 3000);
                
            } else {
                this.showToast(
                    skippedCount > 0 ? 'All selected keys already exist' : 'No keys were imported',
                    'info'
                );
                this.hideImportModal();
            }
            
        } catch (error) {
            console.error('Error during import:', error);
            loadingEl.style.display = 'none';
            this.showToast('Failed to import keys', 'error');
        }
    }

    cancelImport() {
        document.getElementById('importPreview').style.display = 'none';
        this.pendingImportKeys = [];
    }
}

// Global functions for onclick handlers
window.hideToast = function(toastId) {
    document.getElementById(toastId).classList.remove('show');
};

// Function to wait for OTPAuth to load
function waitForOTPAuth() {
    return new Promise((resolve) => {
        if (window.OTPAuth && window.OTPAuth.TOTP) {
            console.log('OTPAuth already loaded');
            resolve();
            return;
        }
        
        const checkOTPAuth = () => {
            if (window.OTPAuth && window.OTPAuth.TOTP) {
                console.log('OTPAuth loaded successfully');
                resolve();
            } else {
                console.log('Waiting for OTPAuth...');
                setTimeout(checkOTPAuth, 50);
            }
        };
        
        checkOTPAuth();
    });
}

// Initialize app when DOM is loaded and OTPAuth is available
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded, waiting for OTPAuth...');
    await waitForOTPAuth();
    console.log('Initializing TOTP Authenticator');
    window.app = new TOTPAuthenticator();
});

// Service Worker registration for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}