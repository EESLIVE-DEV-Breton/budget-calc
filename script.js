document.addEventListener("DOMContentLoaded", () => {
    // List of BoQ files to load
    const boqFiles = [
        '0100.csv', '0400 - 0700.csv', '1000.csv', '2000.csv', '3000.csv', '4000.csv',
        '5000.csv', '7000.csv', '8000.csv', '9000.csv', '11000.csv', '14000.csv'
    ];

    const boqContainer = document.getElementById('boq-container');
    const mainNav = document.getElementById('main-nav');

    // --- PDF Export Functionality ---
    const { jsPDF } = window.jspdf;
    const exportButton = document.getElementById('export-pdf');
    const pdfLoader = document.getElementById('pdf-loader');
    
    // To get a clean PDF, we swap inputs with text spans during export
    const toggleInputsForExport = (showText) => {
        const inputs = document.querySelectorAll('.quantity-input');
        const texts = document.querySelectorAll('.quantity-text');

        inputs.forEach(input => input.style.display = showText ? 'none' : 'block');
        texts.forEach((text, index) => {
            if (showText) {
                text.textContent = inputs[index].value; // Update text with current value
            }
            text.style.display = showText ? 'block' : 'none';
        });
    };

    const generatePdf = async () => {
        exportButton.style.display = 'none';
        pdfLoader.style.display = 'block';
        
        toggleInputsForExport(true); // Switch to text view for a clean PDF

        const content = document.querySelector('main');
        const canvas = await html2canvas(content, {
            scale: 2, // Higher scale for better quality
            logging: false,
            useCORS: true
        });

        toggleInputsForExport(false); // Switch back to input view for user
        exportButton.style.display = 'block';
        pdfLoader.style.display = 'none';

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const ratio = canvasWidth / pdfWidth;
        const imgHeight = canvasHeight / ratio;

        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;

        while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;
        }

        pdf.save('budget-summary.pdf');
    };
    exportButton.addEventListener('click', generatePdf);
    // --- End PDF Export Functionality ---


    const parseCurrency = (value) => {
        if (typeof value !== 'string') return 0;
        return parseFloat(value.replace(/R/g, '').replace(/,/g, '')) || 0;
    };

    const formatCurrency = (value) => {
        return `R${value.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}`;
    };

    const updateTotals = () => {
        let subTotal = 0;
        document.querySelectorAll('.boq-item-row').forEach(row => {
            const quantity = parseFloat(row.querySelector('.quantity-input').value) || 0;
            const supplyRate = parseFloat(row.dataset.supplyRate) || 0;
            const installRate = parseFloat(row.dataset.installRate) || 0;
            const rowTotal = quantity * (supplyRate + installRate);
            row.querySelector('.col-total').textContent = formatCurrency(rowTotal);
            subTotal += rowTotal;
        });

        const vat = subTotal * 0.15;
        const grandTotal = subTotal + vat;

        document.getElementById('summary-subtotal').textContent = formatCurrency(subTotal);
        document.getElementById('summary-vat').textContent = formatCurrency(vat);
        document.getElementById('summary-grandtotal').textContent = formatCurrency(grandTotal);
    };

    const createTable = (title, headers, data) => {
        const categoryId = title.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
        
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'boq-category';
        categoryDiv.id = categoryId; // Add ID for navigation

        // Create and add navigation link
        const navLink = document.createElement('a');
        navLink.href = `#${categoryId}`;
        navLink.textContent = title;
        mainNav.appendChild(navLink);

        const categoryTitle = document.createElement('h2');
        categoryTitle.textContent = title;
        categoryDiv.appendChild(categoryTitle);

        const table = document.createElement('table');
        table.className = 'boq-table';
        const thead = table.createTHead();
        const headerRow = thead.insertRow();
        headers.forEach(headerText => {
            const th = document.createElement('th');
            th.textContent = headerText;
            th.className = `col-${headerText.toLowerCase().replace(/ /g, '-')}`;
            headerRow.appendChild(th);
        });

        const tbody = table.createTBody();
        data.forEach(item => {
            const row = tbody.insertRow();
            row.className = 'boq-item-row';
            row.dataset.supplyRate = parseCurrency(item['Supply Rate']);
            row.dataset.installRate = parseCurrency(item['Install Rate']);
            row.innerHTML = `
                <td class="col-item">${item.Item}</td>
                <td class="col-desc">${item.Description}</td>
                <td class="col-units">${item.Units}</td>
                <td class="col-rate">${item['Supply Rate'] || 'N/A'}</td>
                <td class="col-rate">${item['Install Rate'] || 'N/A'}</td>
                <td class="col-quantity">
                    <input type="number" class="quantity-input" value="${item.Quantity || 0}" min="0">
                    <span class="quantity-text"></span>
                </td>
                <td class="col-total">${formatCurrency(0)}</td>
            `;
            row.querySelector('.quantity-input').addEventListener('input', updateTotals);
        });

        categoryDiv.appendChild(table);
        boqContainer.appendChild(categoryDiv);
    };

    const loadAllData = async () => {
        const promises = boqFiles.map(file => fetch(`data/${file}`).then(response => response.text()));
        try {
            const allCsvData = await Promise.all(promises);
            boqContainer.innerHTML = '';

            allCsvData.forEach((csv, index) => {
                const lines = csv.trim().split('\n').slice(5);
                if (lines.length < 2) return;
                let headers = lines[0].split(',').map(h => h.trim());
                if (headers.length < 7) headers = ["Item", "Description", "Units", "Quantity", "Supply Rate", "Install Rate", "Total"];
                
                const categoryTitle = lines.find(line => line.startsWith(boqFiles[index].split('.')[0].substring(0, 4)))?.split(',')[1]?.replace(/"/g, '') || `Category ${boqFiles[index]}`;
                const data = lines.slice(1).map(line => {
                    const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                    if (values.length < 2 || !values[0] || values.every(v => !v.trim())) return null;
                    const rowData = {};
                    headers.forEach((header, i) => {
                        rowData[header] = values[i] ? values[i].replace(/"/g, '').trim() : '';
                    });
                    return rowData;
                }).filter(Boolean);

                if (data.length > 0) {
                    const displayHeaders = ['Item', 'Description', 'Units', 'Supply Rate', 'Install Rate', 'Quantity', 'Total'];
                    createTable(categoryTitle.trim(), displayHeaders, data);
                }
            });
            updateTotals();
        } catch (error) {
            boqContainer.innerHTML = `<div class="loader">Error loading BoQ data. Details: ${error.message}</div>`;
            console.error("Failed to load data:", error);
        }
    };

    loadAllData();
});
