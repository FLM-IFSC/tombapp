document.addEventListener('DOMContentLoaded', () => {
    // --- Referências ao DOM ---
    const ui = {
        uploadSection: document.getElementById('uploadSection'),
        mainContent: document.getElementById('mainContent'),
        itemDetailsSection: document.getElementById('itemDetailsSection'),
        mainTableSection: document.getElementById('mainTableSection'),
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
        mainTableBody: document.getElementById('mainTableBody'),
        paginationControls: document.getElementById('paginationControls'),
        toast: document.getElementById('toast'),
        loader: document.getElementById('loader'),
    };

    // --- Estado da Aplicação ---
    let patrimonioMap = new Map();
    let currentItem = null;
    let currentPage = 1;
    const ITEMS_PER_PAGE = 50;

    // --- Lógica Principal ---
    function parseCSV(csvText) {
        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: 'greedy',
            complete: (results) => {
                if (results.errors.length > 0) {
                    showLoader(false);
                    showToast(`Erro no parsing: ${results.errors[0].message}`, 'error');
                    return;
                }
                if (results.data.length > 0 && !results.data[0].hasOwnProperty('nr_tombo')) {
                    showLoader(false);
                    showToast("A coluna 'nr_tombo' é obrigatória.", 'error');
                    return;
                }
                initializeApplication(results.data);
            },
            error: (err) => {
                showLoader(false);
                showToast(`Erro fatal ao ler o arquivo: ${err.message}`, 'error');
            }
        });
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
        renderPage(1);
    }

    function renderPage(page) {
        currentPage = page;
        const data = Array.from(patrimonioMap.values());
        const start = (page - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        const paginatedItems = data.slice(start, end);

        renderTable(paginatedItems);
        renderPagination(data.length);
    }

    function renderTable(data) {
        ui.mainTableBody.innerHTML = '';
        if (data.length === 0) {
            ui.mainTableBody.innerHTML = `<tr><td colspan="4" class="text-center p-6 text-gray-500">Nenhum item para exibir.</td></tr>`;
            return;
        }
        const fragment = document.createDocumentFragment();
        data.forEach(item => {
            const row = document.createElement('tr');
            const statusClass = `status-${item.status.toLowerCase().replace(/ /g, '-')}`;
            row.className = 'border-b hover:bg-gray-50 cursor-pointer';
            row.dataset.tombo = item.nr_tombo;
            row.onclick = () => loadItem(item.nr_tombo);

            row.innerHTML = `
                <td class="p-3 font-medium">${item.nr_tombo}</td>
                <td class="p-3">${item.Descrica07 || 'N/A'}</td>
                <td class="p-3">${item.nome || 'N/A'}</td>
                <td class="p-3 text-center"><span class="status-badge ${statusClass}">${item.status}</span></td>
            `;
            fragment.appendChild(row);
        });
        ui.mainTableBody.appendChild(fragment);
    }

    function renderPagination(totalItems) {
        const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
        ui.paginationControls.innerHTML = '';
        if (totalPages <= 1) return;

        const createButton = (text, page, isDisabled = false, isActive = false) => {
            const button = document.createElement('button');
            button.textContent = text;
            button.className = 'pagination-button';
            if (isActive) button.classList.add('active');
            button.disabled = isDisabled;
            button.onclick = () => renderPage(page);
            return button;
        };

        ui.paginationControls.appendChild(createButton('Anterior', currentPage - 1, currentPage === 1));

        for (let i = 1; i <= totalPages; i++) {
             if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
                ui.paginationControls.appendChild(createButton(i, i, false, i === currentPage));
            } else if (i === currentPage - 3 || i === currentPage + 3) {
                 const span = document.createElement('span');
                 span.textContent = '...';
                 span.className = 'p-2';
                 ui.paginationControls.appendChild(span);
            }
        }

        ui.paginationControls.appendChild(createButton('Próximo', currentPage + 1, currentPage === totalPages));
    }

    function loadItem(tomboValue = null) {
        const tombo = tomboValue || ui.tomboInput.value.trim();
        if (!tombo) {
            showToast('Por favor, digite um número de tombo.', 'error');
            return;
        }
        currentItem = patrimonioMap.get(String(tombo));
        if (currentItem) {
            displayItemDetails(currentItem, true);
            highlightTableRow(tombo);
        } else {
            showToast(`Item com tombo ${tombo} não encontrado.`, 'error');
            displayItemDetails(null, false);
        }
        ui.tomboInput.value = '';
        ui.tomboInput.focus();
    }

    function highlightTableRow(tombo) {
        // Remove destaque de outras linhas
        document.querySelectorAll('#mainTableBody tr.bg-green-200').forEach(r => r.classList.remove('bg-green-200'));
        // Adiciona destaque à linha atual
        const row = document.querySelector(`#mainTableBody tr[data-tombo='${tombo}']`);
        if (row) {
            row.classList.add('bg-green-200');
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
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
        displayItemDetails(currentItem, true);
        renderPage(currentPage); // Re-renderiza a tabela para mostrar o novo status
        showToast(toastMessage);
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

    ui.loadButton.addEventListener('click', () => loadItem());
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