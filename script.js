document.addEventListener('DOMContentLoaded', () => {
    // --- Referências ao DOM ---
    const ui = {
        uploadSection: document.getElementById('uploadSection'),
        mainContent: document.getElementById('mainContent'),
        itemDetailsSection: document.getElementById('itemDetailsSection'),
        csvFileInput: document.getElementById('csvFileInput'),
        encodingSelect: document.getElementById('encodingSelect'),
        fileStatus: document.getElementById('file-status'),
        tomboInput: document.getElementById('tomboInput'),
        loadButton: document.getElementById('loadButton'),
        exportButton: document.getElementById('exportButton'),
        itemDescription: document.getElementById('itemDescription'),
        itemTombo: document.getElementById('itemTombo'),
        itemResponsible: document.getElementById('itemResponsible'),
        itemStatus: document.getElementById('itemStatus'),
        actionButtons: document.querySelectorAll('.action-button[data-action]'),
        processedItemsTableBody: document.getElementById('processedItemsTableBody'),
        processedItemsSection: document.getElementById('processedItemsSection'),
        toast: document.getElementById('toast'),
        loader: document.getElementById('loader'),
    };

    // --- Estado da Aplicação ---
    let patrimonioMap = new Map();
    let currentItem = null;
    let processedItems = new Set();

    // --- Lógica Principal ---
    function parseCSV(csvText) {
        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: 'greedy',
            newline: '\r\n', // Tenta a quebra de linha do Windows primeiro
            complete: (results) => {
                // Se falhar, tenta com a quebra de linha do Unix
                if (!results.data.length && csvText.includes('\n')) {
                    Papa.parse(csvText, {
                        header: true,
                        skipEmptyLines: 'greedy',
                        newline: '\n',
                        complete: handleParseResults
                    });
                } else {
                    handleParseResults(results);
                }
            }
        });
    }

    function handleParseResults(results) {
        if (results.errors.length > 0) {
            showLoader(false);
            showToast(`Erro no parsing do CSV: ${results.errors[0].message}`, 'error');
            return;
        }
        if (results.data.length > 0 && !results.data[0].hasOwnProperty('nr_tombo')) {
            showLoader(false);
            showToast("A coluna 'nr_tombo' é obrigatória.", 'error');
            return;
        }
        initializeApplication(results.data);
    }

    function initializeApplication(data) {
        patrimonioMap.clear();
        data.forEach(item => {
            const tombo = String(item.nr_tombo).trim();
            if (tombo) {
                patrimonioMap.set(tombo, { ...item, status: 'Pendente', original_responsavel: item.nome });
            }
        });

        showLoader(false);
        ui.uploadSection.classList.add('hidden');
        ui.mainContent.classList.remove('hidden');
        const itemCount = patrimonioMap.size === 1 ? "1 item" : `${patrimonioMap.size} itens`;
        ui.fileStatus.textContent = `${itemCount} carregado(s) com sucesso!`;
        ui.fileStatus.classList.add('text-ifsc-green');
        showToast('Arquivo carregado. Pronto para buscar.');
    }

    function loadItem() {
        const tombo = ui.tomboInput.value.trim();
        if (!tombo) {
            showToast('Por favor, digite um número de tombo.', 'error');
            return;
        }
        currentItem = patrimonioMap.get(tombo);
        if (currentItem) {
            displayItemDetails(currentItem, true);
        } else {
            showToast(`Item com tombo ${tombo} não encontrado.`, 'error');
            displayItemDetails(null, false);
        }
        ui.tomboInput.value = '';
        ui.tomboInput.focus();
    }

    function displayItemDetails(item, show) {
        if (show && item) {
            ui.itemDescription.textContent = item.Descrica07 || 'Descrição não disponível';
            ui.itemTombo.textContent = `Nº Tombo: ${item.nr_tombo}`;
            ui.itemResponsible.textContent = `Responsável: ${item.nome || 'Não informado'}`;
            updateStatusDisplay(item.status);
            ui.itemDetailsSection.classList.remove('hidden');
        } else {
            ui.itemDetailsSection.classList.add('hidden');
        }
    }

    function updateStatusDisplay(status) {
        const statusText = status.replace(/-/g, ' ');
        ui.itemStatus.textContent = `Status: ${statusText}`;
        ui.itemStatus.className = `status-display status-${status.toLowerCase().replace(/ /g, '-')}`;
    }

    function handleAction(action) {
        if (!currentItem) return;
        let newStatus = currentItem.status;
        let toastMessage = '';

        switch (action) {
            case 'found':
                newStatus = 'Encontrado';
                toastMessage = `Item ${currentItem.nr_tombo} marcado como Encontrado.`;
                break;
            case 'not-found':
                newStatus = 'Não Encontrado';
                toastMessage = `Item ${currentItem.nr_tombo} marcado como Não Encontrado.`;
                break;
            case 'transfer':
                const newResponsible = prompt('Digite o nome do novo responsável:');
                if (newResponsible && newResponsible.trim()) {
                    currentItem.nome = newResponsible.trim();
                    newStatus = 'Transferência Solicitada';
                    toastMessage = `Transferência para ${newResponsible.trim()} solicitada.`;
                } else { return; }
                break;
            case 'dispose':
                newStatus = 'Desfazimento Solicitado';
                toastMessage = 'Solicitação de desfazimento registrada.';
                break;
            default:
                showToast(`Ação '${action}' não implementada.`, 'error');
                return;
        }
        currentItem.status = newStatus;
        patrimonioMap.set(String(currentItem.nr_tombo), currentItem);
        addProcessedItem(currentItem);
        displayItemDetails(currentItem, true);
        showToast(toastMessage);
    }

    function addProcessedItem(item) {
        const tombo = String(item.nr_tombo);
        const rowId = `processed-${tombo}`;
        let row = document.getElementById(rowId);

        if (row) {
            row.cells[2].innerHTML = `<span class="status-badge status-${item.status.toLowerCase().replace(/ /g, '-')}">${item.status}</span>`;
        } else {
            row = ui.processedItemsTableBody.insertRow(0);
            row.id = rowId;
            row.innerHTML = `
                <td class="p-3 font-medium">${tombo}</td>
                <td class="p-3">${item.Descrica07}</td>
                <td class="p-3 text-center"><span class="status-badge status-${item.status.toLowerCase().replace(/ /g, '-')}">${item.status}</span></td>
            `;
        }
        ui.processedItemsSection.classList.remove('hidden');
    }

    // --- Handlers de Eventos ---
    ui.csvFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            showLoader(true);
            const selectedEncoding = ui.encodingSelect.value;
            ui.fileStatus.textContent = `Carregando ${file.name}...`;
            const reader = new FileReader();
            reader.onload = (e) => parseCSV(e.target.result);
            reader.readAsText(file, selectedEncoding);
        }
    });

    ui.loadButton.addEventListener('click', loadItem);
    ui.tomboInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') loadItem(); });

    ui.actionButtons.forEach(button => {
        button.addEventListener('click', () => handleAction(button.dataset.action));
    });

    ui.exportButton.addEventListener('click', () => {
        if (patrimonioMap.size === 0) {
            showToast('Nenhum dado para exportar.', 'error');
            return;
        }
        const dataToExport = Array.from(patrimonioMap.values());
        const csv = Papa.unparse(dataToExport, {
            columns: ['nr_tombo', 'Descrica07', 'nome', 'status', 'original_responsavel'],
            header: true
        });
        const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `relatorio_patrimonio_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Relatório CSV exportado com sucesso!');
    });

    // --- Funções de UI Auxiliares ---
    function showLoader(show) {
        ui.loader.classList.toggle('hidden', !show);
    }

    function showToast(message, type = 'success', duration = 3000) {
        ui.toast.textContent = message;
        ui.toast.className = ``;
        ui.toast.classList.add(type, 'show');
        setTimeout(() => ui.toast.classList.remove('show'), duration);
    }
});