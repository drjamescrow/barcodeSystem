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
});