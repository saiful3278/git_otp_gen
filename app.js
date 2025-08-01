// TOTP Authenticator App
class TOTPAuthenticator {
    constructor() {
        this.keys = [];
        this.timers = new Map();
        this.isEditing = false;
        this.editingId = null;
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadKeys();
        this.startGlobalTimer();
    }

    setupEventListeners() {
        // Modal controls
        document.getElementById('addKeyBtn').addEventListener('click', () => this.showModal());
        document.getElementById('closeModal').addEventListener('click', () => this.hideModal());
        document.getElementById('cancelBtn').addEventListener('click', () => this.hideModal());
        
        // Form submission
        document.getElementById('keyForm').addEventListener('submit', (e) => this.handleFormSubmit(e));
        
        // Click outside modal to close
        document.getElementById('addKeyModal').addEventListener('click', (e) => {
            if (e.target.id === 'addKeyModal') {
                this.hideModal();
            }
        });

        // Escape key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.getElementById('addKeyModal').classList.contains('show')) {
                this.hideModal();
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
                    <button class="btn btn-icon" onclick="app.editKey('${key.id}')" title="Edit">
                        Edit
                    </button>
                    <button class="btn btn-danger" onclick="app.deleteKey('${key.id}')" title="Delete">
                        Delete
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
            if (!window.otplib) {
                console.error('OTPLib not loaded');
                return '------';
            }
            
            // Ensure secret is properly formatted Base32
            const cleanSecret = secret.replace(/\s+/g, '').toUpperCase();
            
            // Validate Base32 format before generating
            if (!this.isValidBase32(cleanSecret)) {
                console.error('Invalid Base32 secret:', secret);
                return '------';
            }
            
            // Generate TOTP code using otplib
            const code = window.otplib.authenticator.generate(cleanSecret);
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
}

// Global functions for onclick handlers
window.hideToast = function(toastId) {
    document.getElementById(toastId).classList.remove('show');
};

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for all scripts to load
    setTimeout(() => {
        console.log('Initializing TOTP Authenticator');
        console.log('OTPLib available:', !!window.otplib);
        if (window.otplib) {
            console.log('OTPLib authenticator:', !!window.otplib.authenticator);
        }
        window.app = new TOTPAuthenticator();
    }, 100);
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