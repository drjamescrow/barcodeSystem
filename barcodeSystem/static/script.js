document.addEventListener('DOMContentLoaded', function() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    const removeFile = document.getElementById('removeFile');
    const generateBtn = document.getElementById('generateBtn');
    const uploadForm = document.getElementById('uploadForm');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const result = document.getElementById('result');
    const error = document.getElementById('error');
    const downloadLink = document.getElementById('downloadLink');
    const labelCount = document.getElementById('labelCount');
    const errorText = document.getElementById('errorText');

    let selectedFile = null;

    // Label size toggle functionality
    const toggleButtons = document.querySelectorAll('.toggle-btn');
    const labelSizeInput = document.getElementById('labelSizeInput');
    const headerSubtitle = document.getElementById('headerSubtitle');

    toggleButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons
            toggleButtons.forEach(btn => btn.classList.remove('active'));

            // Add active class to clicked button
            this.classList.add('active');

            // Update hidden input value
            const selectedSize = this.getAttribute('data-size');
            labelSizeInput.value = selectedSize;

            // Update header subtitle
            if (selectedSize === '3x1') {
                headerSubtitle.textContent = 'Generate 3"×1" labels for thermal printers (203 DPI)';
            } else {
                headerSubtitle.textContent = 'Generate 2"×1" labels for thermal printers (203 DPI)';
            }
        });
    });

    // Click to open file dialog
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    // File input change
    fileInput.addEventListener('change', handleFileSelect);

    // Drag and drop events
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });

    // Remove file
    removeFile.addEventListener('click', () => {
        selectedFile = null;
        fileInput.value = '';
        fileInfo.style.display = 'none';
        dropZone.style.display = 'block';
        generateBtn.disabled = true;
        hideResults();
    });

    // Form submission
    uploadForm.addEventListener('submit', handleSubmit);

    function handleFileSelect(e) {
        const files = e.target.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    }

    function handleFile(file) {
        // Validate file type
        const allowedTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'];
        const allowedExtensions = ['.xlsx', '.csv'];

        const hasValidType = allowedTypes.includes(file.type);
        const hasValidExtension = allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

        if (!hasValidType && !hasValidExtension) {
            showError('Please select a .xlsx or .csv file.');
            return;
        }

        // Validate file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
            showError('File size must be less than 10MB.');
            return;
        }

        selectedFile = file;

        // Display file info
        fileName.textContent = file.name;
        fileSize.textContent = formatFileSize(file.size);

        dropZone.style.display = 'none';
        fileInfo.style.display = 'flex';
        generateBtn.disabled = false;

        hideResults();
    }

    async function handleSubmit(e) {
        e.preventDefault();

        if (!selectedFile) {
            showError('Please select a file first.');
            return;
        }

        showProgress();

        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('label_size', labelSizeInput.value);

        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                // Get filename from Content-Disposition header or use default
                const contentDisposition = response.headers.get('Content-Disposition');
                let filename = 'labels.pdf';
                if (contentDisposition) {
                    const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                    if (filenameMatch) {
                        filename = filenameMatch[1].replace(/['"]/g, '');
                    }
                }

                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);

                downloadLink.href = url;
                downloadLink.download = filename;

                // Try to get label count from response headers
                const labelCountHeader = response.headers.get('X-Label-Count');
                const count = labelCountHeader || 'multiple';
                labelCount.textContent = `Generated ${count} labels successfully.`;

                showSuccess();
            } else {
                const errorData = await response.json();
                showError(errorData.error || 'An error occurred while processing the file.');
            }
        } catch (err) {
            console.error('Upload error:', err);
            showError('Network error. Please check your connection and try again.');
        }
    }

    function showProgress() {
        hideResults();
        progressContainer.style.display = 'block';
        progressBar.style.width = '100%';
        progressText.textContent = 'Processing file and generating labels...';
        generateBtn.disabled = true;
    }

    function hideProgress() {
        progressContainer.style.display = 'none';
        progressBar.style.width = '0%';
        generateBtn.disabled = false;
    }

    function showSuccess() {
        hideProgress();
        result.style.display = 'block';
        error.style.display = 'none';

        // Play undertaker's bell at full volume
        const audio = new Audio('/static/undertakers-bell_2UwFCIe.mp3');
        audio.volume = 1.0;
        audio.play().catch(err => console.log('Audio playback failed:', err));

        // Trigger purple flame animation on title for 10 seconds
        const title = document.querySelector('header h1');
        title.classList.add('purple-flame');
        setTimeout(() => {
            title.classList.remove('purple-flame');
        }, 10000);
    }

    function showError(message) {
        hideProgress();
        error.style.display = 'block';
        result.style.display = 'none';
        errorText.textContent = message;
    }

    function hideResults() {
        result.style.display = 'none';
        error.style.display = 'none';
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Settings Modal Functionality
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeModal = document.querySelector('.close');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');

    let currentSettings = null;

    // Open settings modal
    settingsBtn.addEventListener('click', async () => {
        await loadSettings();
        settingsModal.style.display = 'block';
    });

    // Close modal events
    closeModal.addEventListener('click', () => {
        settingsModal.style.display = 'none';
    });

    cancelSettingsBtn.addEventListener('click', () => {
        settingsModal.style.display = 'none';
    });

    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === settingsModal) {
            settingsModal.style.display = 'none';
        }
    });

    // Tab switching
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');

            // Update tab buttons
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // Update tab content
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(targetTab + '-tab').classList.add('active');
        });
    });

    // Load settings from API
    async function loadSettings() {
        try {
            const response = await fetch('/api/settings');
            if (!response.ok) throw new Error('Failed to load settings');

            currentSettings = await response.json();
            renderProductTypes();
            renderShorteningRules();
            renderApplicationSettings();
        } catch (error) {
            console.error('Error loading settings:', error);
            alert('Failed to load settings. Please try again.');
        }
    }

    // Render product types list
    function renderProductTypes() {
        const list = document.getElementById('productTypesList');
        list.innerHTML = '';

        currentSettings.product_types.forEach((type, index) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${type}</span>
                <button class="delete-btn" onclick="removeProductType(${index})">Delete</button>
            `;
            list.appendChild(li);
        });
    }

    // Render shortening rules
    function renderShorteningRules() {
        const container = document.getElementById('shorteningRulesList');
        container.innerHTML = '';

        currentSettings.shortening_rules.forEach((rule, ruleIndex) => {
            const ruleDiv = document.createElement('div');
            ruleDiv.className = 'rule-item';

            let conditionsHtml = '';
            rule.conditions.forEach((condition, condIndex) => {
                const isDefault = condition.default || false;
                const conditionText = isDefault ?
                    `Default: "${condition.result}"` :
                    `If contains "${condition.contains}" → "${condition.result}"`;

                const isFirst = condIndex === 0;
                const isLast = condIndex === rule.conditions.length - 1;

                conditionsHtml += `
                    <div class="condition-item">
                        <span>${conditionText}</span>
                        <div class="condition-controls">
                            <button class="edit-btn" onclick="editCondition(${ruleIndex}, ${condIndex})" title="Edit">✏️</button>
                            <button class="move-btn" ${isFirst ? 'disabled' : ''} onclick="moveConditionUp(${ruleIndex}, ${condIndex})" title="Move Up">↑</button>
                            <button class="move-btn" ${isLast ? 'disabled' : ''} onclick="moveConditionDown(${ruleIndex}, ${condIndex})" title="Move Down">↓</button>
                            <button class="delete-btn" onclick="removeCondition(${ruleIndex}, ${condIndex})">Delete</button>
                        </div>
                    </div>
                `;
            });

            const isFirstRule = ruleIndex === 0;
            const isLastRule = ruleIndex === currentSettings.shortening_rules.length - 1;

            ruleDiv.innerHTML = `
                <div class="rule-header">
                    <span class="rule-pattern">${rule.pattern}</span>
                    <div class="rule-controls">
                        <button class="edit-btn" onclick="editRule(${ruleIndex})" title="Edit Pattern">✏️</button>
                        <button class="move-btn" ${isFirstRule ? 'disabled' : ''} onclick="moveRuleUp(${ruleIndex})" title="Move Up">↑</button>
                        <button class="move-btn" ${isLastRule ? 'disabled' : ''} onclick="moveRuleDown(${ruleIndex})" title="Move Down">↓</button>
                        <button class="delete-btn" onclick="removeRule(${ruleIndex})">Delete Rule</button>
                    </div>
                </div>
                <div class="rule-conditions">
                    ${conditionsHtml}
                    <button class="btn-secondary" onclick="addCondition(${ruleIndex})">Add Condition</button>
                </div>
            `;
            container.appendChild(ruleDiv);
        });
    }

    // Render application settings
    function renderApplicationSettings() {
        const maxBinsInput = document.getElementById('maxBinsInput');
        const overflowNameInput = document.getElementById('overflowNameInput');
        const defaultLabelSizeSelect = document.getElementById('defaultLabelSizeSelect');

        if (maxBinsInput) {
            maxBinsInput.value = currentSettings.max_bins || 12;
        }
        if (overflowNameInput) {
            overflowNameInput.value = currentSettings.overflow_name || 'THEPIT';
        }
        if (defaultLabelSizeSelect) {
            defaultLabelSizeSelect.value = currentSettings.default_label_size || '3x1';
        }
    }

    // Apply default label size from settings
    function applyDefaultLabelSize() {
        const defaultSize = currentSettings.default_label_size || '3x1';
        const toggleButtons = document.querySelectorAll('.toggle-btn');
        const labelSizeInput = document.getElementById('labelSizeInput');
        const headerSubtitle = document.getElementById('headerSubtitle');

        // Update the toggle buttons
        toggleButtons.forEach(btn => {
            const btnSize = btn.getAttribute('data-size');
            if (btnSize === defaultSize) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update the hidden input
        if (labelSizeInput) {
            labelSizeInput.value = defaultSize;
        }

        // Update header subtitle
        if (headerSubtitle) {
            if (defaultSize === '3x1') {
                headerSubtitle.textContent = 'Generate 3"×1" labels for thermal printers (203 DPI)';
            } else {
                headerSubtitle.textContent = 'Generate 2"×1" labels for thermal printers (203 DPI)';
            }
        }
    }

    // Product type management
    document.getElementById('addProductTypeBtn').addEventListener('click', () => {
        const input = document.getElementById('newProductType');
        const value = input.value.trim();

        if (value && !currentSettings.product_types.includes(value)) {
            currentSettings.product_types.push(value);
            input.value = '';
            renderProductTypes();
        }
    });

    // Add new shortening rule
    document.getElementById('addRuleBtn').addEventListener('click', () => {
        const pattern = prompt('Enter pattern to match (e.g., "LUXURY HEAVY TEE"):');
        if (pattern && pattern.trim()) {
            const newRule = {
                pattern: pattern.trim().toUpperCase(),
                conditions: [
                    { default: true, result: pattern.trim() }
                ]
            };
            currentSettings.shortening_rules.push(newRule);
            renderShorteningRules();
        }
    });

    // Test shortening rules
    document.getElementById('testRulesBtn').addEventListener('click', () => {
        const input = document.getElementById('testInput');
        const testValue = input.value.trim();
        const resultDiv = document.getElementById('testResult');

        if (!testValue) {
            resultDiv.innerHTML = '';
            return;
        }

        // Simulate the shortening logic
        const result = applyShortening(testValue);
        resultDiv.innerHTML = `<div class="test-result success">Input: "${testValue}" → Output: "${result}"</div>`;
    });

    // Apply shortening logic (simulates backend logic)
    function applyShortening(productType) {
        const productTypeUpper = productType.toUpperCase();

        for (const rule of currentSettings.shortening_rules) {
            const pattern = rule.pattern.toUpperCase();
            if (pattern && productTypeUpper.includes(pattern)) {
                for (const condition of rule.conditions) {
                    if (condition.default) {
                        return condition.result;
                    } else if (condition.contains && productTypeUpper.includes(condition.contains.toUpperCase())) {
                        return condition.result;
                    }
                }
                break;
            }
        }
        return productType;
    }

    // Export settings
    document.getElementById('exportBtn').addEventListener('click', async () => {
        try {
            const response = await fetch('/api/settings/export');
            if (!response.ok) throw new Error('Export failed');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'product_mappings_export.json';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            alert('Failed to export settings: ' + error.message);
        }
    });

    // Import settings
    document.getElementById('importBtn').addEventListener('click', () => {
        document.getElementById('importFile').click();
    });

    document.getElementById('importFile').addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/settings/import', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error);

            alert('Settings imported successfully!');
            await loadSettings(); // Reload settings
        } catch (error) {
            alert('Failed to import settings: ' + error.message);
        }
    });

    // Reset to defaults
    document.getElementById('resetBtn').addEventListener('click', async () => {
        if (!confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
            return;
        }

        const defaultSettings = {
            product_types: [
                "Soft Premium Tee - Black",
                "Soft Premium Tee - White",
                "Luxury Heavy Tee - Black",
                "Luxury Heavy Tee - Vintage Black",
                "Luxury Heavy Tee - Stone Wash"
            ],
            shortening_rules: [
                {
                    pattern: "LUXURY HEAVY TEE",
                    conditions: [
                        { contains: "BLACK", result: "LUX TEE - BK" },
                        { contains: "STONE", result: "LUX TEE - STONE" },
                        { default: true, result: "LUX TEE" }
                    ]
                },
                {
                    pattern: "SOFT PREMIUM TEE",
                    conditions: [
                        { contains: "WHITE", result: "SOFT TEE - WH" },
                        { contains: "BLACK", result: "SOFT TEE - BK" },
                        { default: true, result: "SOFT TEE" }
                    ]
                }
            ]
        };

        try {
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(defaultSettings)
            });

            if (!response.ok) throw new Error('Failed to reset settings');

            currentSettings = defaultSettings;
            renderProductTypes();
            renderShorteningRules();
            alert('Settings reset to defaults successfully!');
        } catch (error) {
            alert('Failed to reset settings: ' + error.message);
        }
    });

    // Save settings
    saveSettingsBtn.addEventListener('click', async () => {
        try {
            // Update application settings from form fields
            const maxBinsInput = document.getElementById('maxBinsInput');
            const overflowNameInput = document.getElementById('overflowNameInput');
            const defaultLabelSizeSelect = document.getElementById('defaultLabelSizeSelect');

            if (maxBinsInput) {
                currentSettings.max_bins = parseInt(maxBinsInput.value) || 12;
            }
            if (overflowNameInput) {
                currentSettings.overflow_name = overflowNameInput.value.trim() || 'THEPIT';
            }
            if (defaultLabelSizeSelect) {
                currentSettings.default_label_size = defaultLabelSizeSelect.value || '3x1';
            }

            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentSettings)
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error);

            alert('Settings saved successfully!');
            settingsModal.style.display = 'none';

            // Apply default label size if it changed
            applyDefaultLabelSize();
        } catch (error) {
            alert('Failed to save settings: ' + error.message);
        }
    });

    // Global functions for inline onclick handlers
    window.removeProductType = function(index) {
        currentSettings.product_types.splice(index, 1);
        renderProductTypes();
    };

    window.removeRule = function(ruleIndex) {
        currentSettings.shortening_rules.splice(ruleIndex, 1);
        renderShorteningRules();
    };

    window.removeCondition = function(ruleIndex, condIndex) {
        currentSettings.shortening_rules[ruleIndex].conditions.splice(condIndex, 1);
        renderShorteningRules();
    };

    window.moveConditionUp = function(ruleIndex, condIndex) {
        if (condIndex > 0) {
            const conditions = currentSettings.shortening_rules[ruleIndex].conditions;
            const temp = conditions[condIndex];
            conditions[condIndex] = conditions[condIndex - 1];
            conditions[condIndex - 1] = temp;
            renderShorteningRules();
        }
    };

    window.moveConditionDown = function(ruleIndex, condIndex) {
        const conditions = currentSettings.shortening_rules[ruleIndex].conditions;
        if (condIndex < conditions.length - 1) {
            const temp = conditions[condIndex];
            conditions[condIndex] = conditions[condIndex + 1];
            conditions[condIndex + 1] = temp;
            renderShorteningRules();
        }
    };

    window.moveRuleUp = function(ruleIndex) {
        if (ruleIndex > 0) {
            const rules = currentSettings.shortening_rules;
            const temp = rules[ruleIndex];
            rules[ruleIndex] = rules[ruleIndex - 1];
            rules[ruleIndex - 1] = temp;
            renderShorteningRules();
        }
    };

    window.moveRuleDown = function(ruleIndex) {
        const rules = currentSettings.shortening_rules;
        if (ruleIndex < rules.length - 1) {
            const temp = rules[ruleIndex];
            rules[ruleIndex] = rules[ruleIndex + 1];
            rules[ruleIndex + 1] = temp;
            renderShorteningRules();
        }
    };

    window.editRule = function(ruleIndex) {
        const currentPattern = currentSettings.shortening_rules[ruleIndex].pattern;
        const newPattern = prompt('Edit pattern to match:', currentPattern);
        if (newPattern && newPattern.trim()) {
            currentSettings.shortening_rules[ruleIndex].pattern = newPattern.trim().toUpperCase();
            renderShorteningRules();
        }
    };

    window.editCondition = function(ruleIndex, condIndex) {
        const condition = currentSettings.shortening_rules[ruleIndex].conditions[condIndex];
        const isDefault = condition.default || false;

        if (isDefault) {
            const newResult = prompt('Edit default result:', condition.result);
            if (newResult && newResult.trim()) {
                condition.result = newResult.trim();
                renderShorteningRules();
            }
        } else {
            const newContains = prompt('Edit text that must be contained:', condition.contains);
            if (newContains !== null) { // User didn't cancel
                const newResult = prompt('Edit shortened result:', condition.result);
                if (newResult && newResult.trim()) {
                    condition.result = newResult.trim();
                    if (newContains && newContains.trim()) {
                        condition.contains = newContains.trim().toUpperCase();
                    }
                    renderShorteningRules();
                }
            }
        }
    };

    window.addCondition = function(ruleIndex) {
        const containsText = prompt('Enter text that must be contained (leave empty for default):');
        const resultText = prompt('Enter the shortened result:');

        if (resultText && resultText.trim()) {
            const newCondition = containsText && containsText.trim() ?
                { contains: containsText.trim().toUpperCase(), result: resultText.trim() } :
                { default: true, result: resultText.trim() };

            currentSettings.shortening_rules[ruleIndex].conditions.push(newCondition);
            renderShorteningRules();
        }
    };

    // Load settings on page load to apply default label size
    (async function initializeSettings() {
        try {
            const response = await fetch('/api/settings');
            if (response.ok) {
                currentSettings = await response.json();
                applyDefaultLabelSize();
            }
        } catch (error) {
            console.error('Error loading initial settings:', error);
        }
    })();
});