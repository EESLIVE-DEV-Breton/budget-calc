document.addEventListener("DOMContentLoaded", () => {
    // Your specific Google Sheet URL is now included here
    const googleSheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRloxy6yhB2fb90UyVAf8kianuy6Iwps-UjaVO_h9_ExdSCaLG8Vfv63wgcheiDz7Zm8Ajv6zpHeBCq/pub?gid=0&single=true&output=csv';

    const boqContainer = document.getElementById('boq-container');
    const mainNav = document.getElementById('main-nav');

    // --- PDF Export Functionality ---
    const { jsPDF } = window.jspdf;
    const exportButton = document.getElementById('export-pdf');
    const pdfLoader = document.getElementById('pdf-loader');
    
    const toggleInputsForExport = (showText) => {
        const inputs = document.querySelectorAll('.quantity-input');
        const texts = document.querySelectorAll('.quantity-text');
        inputs.forEach(input => input.style.display = showText ? 'none' : 'block');
        texts.forEach((text, index) => {
            if (showText) {
                text.textContent = inputs[index].value;
            }
            text.style.display = showText ? 'block' : 'none';
        });
    };

    const generatePdf = async () => {
        exportButton.style.display = 'none';
        pdfLoader.style.display = 'block';
        toggleInputsForExport(true);

        const content = document.querySelector('main');
        const canvas = await html2canvas(content, { scale: 2, logging: false, useCORS: true });

        toggleInputsForExport(false);
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
    // --- End PDF Export ---

    const parseCurrency = (value) => {
        if (typeof value === 'number') return value;
        if (typeof value !== 'string') return 0;
        return parseFloat(value.replace(/R/g, '').replace(/,/g, '')) || 0;
    };

    const formatCurrency = (value) => {
        // Ensure value is a number before calling toFixed
        const numberValue = Number(value);
        if (isNaN(numberValue)) {
            return 'R0.00';
        }
        return `R${numberValue.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}`;
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
        categoryDiv.id = categoryId;

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
                <td class="col-rate">${formatCurrency(item['Supply Rate'])}</td>
                <td class="col-rate">${formatCurrency(item['Install Rate'])}</td>
                <td class="col-quantity">
                    <input type="number" class="quantity-input" value="0" min="0">
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
        try {
            const response = await fetch(googleSheetUrl);
            const csvData = await response.text();

            const lines = csvData.trim().split('\n');
            const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
            const data = lines.slice(1).map(line => {
                const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                const rowData = {};
                headers.forEach((header, i) => {
                    rowData[header] = values[i] ? values[i].replace(/"/g, '').trim() : '';
                });
                return rowData;
            });

            const groupedData = data.reduce((acc, row) => {
                const category = row.Category;
                if (category) { // Only process rows that have a category
                    if (!acc[category]) {
                        acc[category] = [];
                    }
                    acc[category].push(row);
                }
                return acc;
            }, {});

            boqContainer.innerHTML = '';
            mainNav.innerHTML = '';

            const displayHeaders = ['Item', 'Description', 'Units', 'Supply Rate', 'Install Rate', 'Quantity', 'Total'];
            
            for (const categoryName in groupedData) {
                createTable(categoryName, displayHeaders, groupedData[categoryName]);
            }

            updateTotals();
        } catch (error) {
            boqContainer.innerHTML = `<div class="loader">Error loading BoQ data from Google Sheets. Check the URL and make sure the sheet is published correctly. Details: ${error.message}</div>`;
            console.error("Failed to load data:", error);
        }
    };

    loadAllData();
});
