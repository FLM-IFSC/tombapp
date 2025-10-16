document.addEventListener('DOMContentLoaded', () => {
    // --- Referências ao DOM ---
    const ui = {
        uploadSection: document.getElementById('uploadSection'),
        mainContent: document.getElementById('mainContent'),
        itemDetailsSection: document.getElementById('itemDetailsSection'),
        csvFileInput: document.getElementById('csvFileInput'),
        fileStatus: document.getElementById('file-status'),
        tomboInput: document.getElementById('tomboInput'),
        loadButton: document.getElementById('loadButton'),
        itemDescription: document.getElementById('itemDescription'),
        itemTombo: document.getElementById('itemTombo'),
        itemResponsible: document.getElementById('itemResponsible'),
        itemStatus: document.getElementById('itemStatus'),
        actionButtons: document.querySelectorAll('.action-button[data-action]'),
        exportButton: document.getElementById('exportButton'),
        toast: document.getElementById('toast'),
        loader: document.getElementById('loader'),
    };

    // --- Estado da Aplicação ---
    let patrimonioMap = new Map();
    let currentItem = null;

    // --- Lógica Principal ---
    function parseCSV(csvText) {
        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: 'greedy',
            complete: (results) => {
                if (results.errors.length > 0) {
                    showLoader(false);
                    showToast(`Erro no parsing do CSV: ${results.errors[0].message}`, 'error');
                    return;
                }
                if (results.data.length > 0 && !results.data[0].hasOwnProperty('nr_tombo')) {
                    showLoader(false);
                    showToast("A coluna 'nr_tombo' é obrigatória no arquivo CSV.", 'error');
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
        ui.fileStatus.textContent = `${patrimonioMap.size} itens carregados com sucesso!`;
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
        displayItemDetails(currentItem, true); // Passa o item e show=true para re-renderizar
        showToast(toastMessage);
    }

    // --- Handlers de Eventos ---
    ui.csvFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            showLoader(true);
            ui.fileStatus.textContent = `Carregando ${file.name}...`;
            const reader = new FileReader();
            reader.onload = (e) => parseCSV(e.target.result);
            reader.readAsText(file, 'UTF-8');
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
            columns: ['nr_tombo', 'Descrica07', 'nome', 'status', 'original_responsavel'], // Define a ordem e quais colunas exportar
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