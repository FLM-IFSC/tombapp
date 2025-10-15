document.addEventListener('DOMContentLoaded', () => {
    // --- Referências ao DOM ---
    const ui = {
        uploadSection: document.getElementById('uploadSection'),
        mainContent: document.getElementById('mainContent'),
        csvFileInput: document.getElementById('csvFileInput'),
        tomboInput: document.getElementById('tomboInput'),
        checkButton: document.getElementById('checkButton'),
        filterInput: document.getElementById('filterInput'),
        transferButton: document.getElementById('transferButton'),
        exportButton: document.getElementById('exportButton'),
        resetButton: document.getElementById('resetButton'),
        patrimonioTableBody: document.getElementById('patrimonioTableBody'),
        selectAllCheckbox: document.getElementById('selectAllCheckbox'),
        totalCount: document.getElementById('totalCount'),
        foundCount: document.getElementById('foundCount'),
        transferredCount: document.getElementById('transferredCount'),
        pendingCount: document.getElementById('pendingCount'),
        paginationControls: document.getElementById('paginationControls'),
        toast: document.getElementById('toast'),
        loader: document.getElementById('loader'),
    };

    // --- Estado da Aplicação ---
    let patrimonioData = [];
    let fuse;
    let currentFilter = '';
    let currentPage = 1;
    const ITEMS_PER_PAGE = 50;

    // --- Inicialização do Worker ---
    console.log("[Main] Inicializando worker...");
    const worker = new Worker('worker.js');

    worker.onmessage = function(e) {
        const { command, payload } = e.data;
        console.log(`[Main] Mensagem recebida do worker: ${command}`);

        switch (command) {
            case 'parse-complete':
                initializeApplication(payload);
                break;
            case 'error':
                console.error(`[Main] Erro recebido do worker: ${payload}`);
                showLoader(false);
                showToast(payload, 'error');
                break;
        }
    };
    worker.onerror = (err) => console.error("[Main] Erro fatal no worker:", err);

    // --- Lógica Principal ---
    function initializeApplication(data) {
        patrimonioData = data.map(item => ({
            ...item,
            status: 'Pendente',
            original_responsavel: item.nome
        }));

        const fuseOptions = {
            keys: ['nr_tombo', 'Descrica07', 'nome'],
            includeScore: true,
            threshold: 0.3,
        };
        fuse = new Fuse(patrimonioData, fuseOptions);

        showLoader(false);
        ui.uploadSection.classList.add('hidden');
        ui.mainContent.classList.remove('hidden');
        showToast(`${patrimonioData.length} itens carregados e indexados!`);
        renderPage(1);
        updateStats();
    }

    function searchAndRender() {
        currentPage = 1; // Reseta para a primeira página a cada nova busca
        renderPage(currentPage);
    }

    function renderPage(page) {
        currentPage = page;
        let results = [];

        if (currentFilter) {
            results = fuse.search(currentFilter).map(result => result.item);
        } else {
            results = patrimonioData;
        }

        const start = (page - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        const paginatedItems = results.slice(start, end);

        renderTable(paginatedItems);
        renderPagination(results.length);
    }

    function renderTable(data) {
        ui.patrimonioTableBody.innerHTML = '';
        if (data.length === 0) {
            ui.patrimonioTableBody.innerHTML = `<tr><td colspan="5" class="text-center p-6 text-gray-500">Nenhum item encontrado.</td></tr>`;
            return;
        }
        const fragment = document.createDocumentFragment();
        data.forEach(item => {
            const row = document.createElement('tr');
            const statusClass = `status-${item.status.toLowerCase()}`;
            row.className = `border-b hover:bg-gray-50`;
            if (item.status === 'Encontrado') row.classList.add('bg-green-50');
            if (item.status === 'Transferido') row.classList.add('bg-blue-50');
            row.dataset.tombo = item.nr_tombo;

            row.innerHTML = `
                <td class="p-3 text-center"><input type="checkbox" class="item-checkbox" data-tombo="${item.nr_tombo}"></td>
                <td class="p-3 font-medium">${item.nr_tombo}</td>
                <td class="p-3">${item.Descrica07 || 'N/A'}</td>
                <td class="p-3">${item.nome || 'N/A'}</td>
                <td class="p-3 text-center"><span class="status-badge ${statusClass}">${item.status}</span></td>
            `;
            fragment.appendChild(row);
        });
        ui.patrimonioTableBody.appendChild(fragment);
        updateCheckboxState();
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

        // Lógica simplificada de exibição de páginas
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

    function updateStats() {
        const total = patrimonioData.length;
        const found = patrimonioData.filter(item => item.status === 'Encontrado').length;
        const transferred = patrimonioData.filter(item => item.status === 'Transferido').length;
        const pending = total - found - transferred;

        ui.totalCount.textContent = total;
        ui.foundCount.textContent = found;
        ui.transferredCount.textContent = transferred;
        ui.pendingCount.textContent = pending;
    }

    function processCheck() {
        const tomboValue = ui.tomboInput.value.trim();
        if (!tomboValue) return;

        const item = patrimonioData.find(p => p.nr_tombo == tomboValue);
        if (item) {
            if (item.status === 'Pendente') {
                item.status = 'Encontrado';
                showToast(`Item ${tomboValue} encontrado!`);
            } else {
                showToast(`Item ${tomboValue} já foi conferido (Status: ${item.status}).`, 'error');
            }
            updateStats();
            renderPage(currentPage); // Re-renderiza a página atual para refletir a mudança
        } else {
            showToast(`Item com tombo ${tomboValue} não encontrado na lista.`, 'error');
        }
        ui.tomboInput.value = '';
        ui.tomboInput.focus();
    }

    function updateCheckboxState() {
        const selectedCount = document.querySelectorAll('.item-checkbox:checked').length;
        ui.transferButton.disabled = selectedCount === 0;
        if (ui.transferButton.querySelector('span')) {
            ui.transferButton.querySelector('span').textContent = selectedCount > 0 ? `Transferir (${selectedCount})` : 'Transferir';
        }
    }

    // --- Handlers de Eventos ---
    ui.csvFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            showLoader(true);
            const reader = new FileReader();
            reader.onload = (e) => worker.postMessage({ command: 'parse', payload: { csvText: e.target.result } });
            reader.readAsText(file);
        }
    });

    ui.checkButton.addEventListener('click', processCheck);
    ui.tomboInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); processCheck(); } });

    let filterTimeout;
    ui.filterInput.addEventListener('input', (e) => {
        clearTimeout(filterTimeout);
        filterTimeout = setTimeout(() => {
            currentFilter = e.target.value;
            searchAndRender();
        }, 300);
    });

    ui.patrimonioTableBody.addEventListener('change', (e) => { if (e.target.classList.contains('item-checkbox')) updateCheckboxState(); });

    ui.selectAllCheckbox.addEventListener('change', (e) => {
        document.querySelectorAll('.item-checkbox').forEach(cb => cb.checked = e.target.checked);
        updateCheckboxState();
    });

    ui.transferButton.addEventListener('click', () => {
        const selectedTombos = Array.from(document.querySelectorAll('.item-checkbox:checked')).map(cb => cb.dataset.tombo);
        if (selectedTombos.length === 0) return;
        const newResponsible = prompt(`Digite o nome do novo responsável para os ${selectedTombos.length} itens:`);
        if (newResponsible && newResponsible.trim() !== '') {
            selectedTombos.forEach(tombo => {
                const item = patrimonioData.find(p => p.nr_tombo == tombo);
                if (item) {
                    item.nome = newResponsible.trim();
                    item.status = 'Transferido';
                }
            });
            updateStats();
            renderPage(currentPage);
            ui.selectAllCheckbox.checked = false;
            showToast(`${selectedTombos.length} itens transferidos para ${newResponsible.trim()}.`);
        }
    });

    ui.exportButton.addEventListener('click', () => {
        if (patrimonioData.length === 0) { showToast('Nenhum dado para exportar.', 'error'); return; }
        const exportData = patrimonioData.map(item => ({
            nr_tombo: item.nr_tombo,
            Descrica07: item.Descrica07,
            responsavel_original: item.original_responsavel,
            responsavel_atual: item.nome,
            status_conferencia: item.status,
            data_conferencia: (item.status !== 'Pendente') ? new Date().toLocaleString('pt-BR') : ''
        }));
        const csv = Papa.unparse(exportData);
        const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `relatorio_patrimonio_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        showToast('Relatório CSV gerado com sucesso!');
    });

    ui.resetButton.addEventListener('click', () => {
        if (confirm('Você tem certeza que deseja apagar todos os dados? Esta ação recarregará a página.')) {
            location.reload();
        }
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

    // --- Inicialização ---
    showLoader(false); // Garante que o loader esteja oculto no início
});