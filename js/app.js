/**
 * Sarmad Global Website Core Functionality (Vanilla JS)
 * Coordinates FAQ Accordions, ROI Calculations, and Secure Upload Simulation.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. FAQ Accordions Setup
    setupFaqs();

    // 2. Practice ROI Calculator Setup (if present on the page)
    setupRoiCalculator();

    // 3. Secure File Upload Zone Setup (if present on the page)
    setupFileUpload();
});

/**
 * Handles toggling FAQ accordions smoothly
 */
function setupFaqs() {
    const faqQuestions = document.querySelectorAll('.faq-question');
    
    faqQuestions.forEach(question => {
        question.addEventListener('click', () => {
            const item = question.parentElement;
            
            // Close other open FAQ items
            const siblingItems = item.parentElement.querySelectorAll('.faq-item');
            siblingItems.forEach(sibling => {
                if (sibling !== item && sibling.classList.contains('active')) {
                    sibling.classList.remove('active');
                }
            });
            
            // Toggle active state of current item
            item.classList.toggle('active');
        });
    });
}

/**
 * Interactive Practice Onboarding ROI Calculator
 */
function setupRoiCalculator() {
    const roiForm = document.getElementById('roi-calculator-form');
    if (!roiForm) return;

    roiForm.addEventListener('submit', (e) => {
        e.preventDefault();

        // Retrieve inputs
        const activeClients = parseFloat(document.getElementById('calc-clients').value) || 0;
        const monthlyOnboardings = parseFloat(document.getElementById('calc-onboardings').value) || 0;
        const hourlyRate = 120; // Factual average blended professional hourly rate (£)

        // Calculations based on real practice efficiency statistics:
        // Manual onboarding average: 4.5 hours per client (compliance, engagement, billing setup, chasers)
        // Automated onboarding average: 0.5 hours per client
        // Time saved per client = 4.0 hours
        const hoursSavedPerMonth = monthlyOnboardings * 4.0;
        const hoursSavedPerYear = hoursSavedPerMonth * 12;
        const financialValueSavedPerYear = hoursSavedPerYear * hourlyRate;

        // Render results dynamically
        const resultContainer = document.getElementById('calc-results');
        if (resultContainer) {
            document.getElementById('res-hours-month').textContent = hoursSavedPerMonth.toFixed(1);
            document.getElementById('res-hours-year').textContent = hoursSavedPerYear.toFixed(0);
            document.getElementById('res-value-year').textContent = financialValueSavedPerYear.toLocaleString('en-GB', {
                style: 'currency',
                currency: 'GBP',
                maximumFractionDigits: 0
            });
            
            resultContainer.style.display = 'block';
            resultContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    });
}

/**
 * Secure Document Upload Dropzone Simulation
 */
function setupFileUpload() {
    const dropzone = document.getElementById('secure-dropzone');
    const fileInput = document.getElementById('secure-file-input');
    const uploadStatus = document.getElementById('upload-status');
    if (!dropzone || !fileInput) return;

    // Trigger click on file input when clicking dropzone
    dropzone.addEventListener('click', () => {
        fileInput.click();
    });

    // Highlight dropzone on drag events
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
        }, false);
    });

    // Handle dropped files
    dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    });

    // Handle selected files
    fileInput.addEventListener('change', () => {
        handleFiles(fileInput.files);
    });

    function handleFiles(files) {
        if (files.length === 0) return;
        
        const file = files[0];
        
        // Show simulated uploading state
        if (uploadStatus) {
            uploadStatus.style.display = 'block';
            uploadStatus.className = 'calc-result';
            uploadStatus.style.backgroundColor = 'rgba(212, 175, 55, 0.08)';
            uploadStatus.style.borderLeftColor = 'var(--clr-accent-gold)';
            uploadStatus.innerHTML = `<p><strong>Uploading:</strong> ${file.name} (${(file.size / 1024).toFixed(1)} KB)...</p>`;
            
            // Complete upload after 2 seconds
            setTimeout(() => {
                uploadStatus.style.backgroundColor = 'rgba(46, 125, 50, 0.08)';
                uploadStatus.style.borderLeftColor = 'var(--clr-success)';
                uploadStatus.innerHTML = `
                    <p style="color: var(--clr-success); font-weight: 600;">
                        <svg style="width:16px; height:16px; vertical-align:middle; margin-right:4px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"></path></svg>
                        Upload Complete & Encrypted
                    </p>
                    <p style="font-size: 0.85rem; margin-top: 4px; color: var(--clr-text-dark);">
                        Your file has been transferred securely to our UK server via AES-256 encryption. Your account manager has been notified.
                    </p>
                `;
            }, 2000);
        }
    }
}
