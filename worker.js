// Importa a biblioteca PapaParse para o escopo do worker
self.importScripts('https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.2/papaparse.min.js');

// Escuta por mensagens da thread principal (script.js)
console.log('[Worker] Worker carregado e pronto.');

self.onmessage = function(e) {
    const { command, payload } = e.data;
    console.log(`[Worker] Comando '${command}' recebido.`);

    if (command === 'parse') {
        const { csvText } = payload;
        console.log(`[Worker] Iniciando parsing de ${csvText.length} caracteres.`);

        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                console.log(`[Worker] Parsing concluído. ${results.data.length} linhas, ${results.errors.length} erros.`);
                if (results.errors.length > 0) {
                    self.postMessage({
                        command: 'error',
                        payload: `Erro no parsing do CSV: ${results.errors[0].message}`
                    });
                    return;
                }

                // Validação de colunas essenciais
                if (results.data.length > 0 && (!results.data[0].hasOwnProperty('nr_tombo') || !results.data[0].hasOwnProperty('Descrica07'))) {
                    self.postMessage({
                        command: 'error',
                        payload: "O arquivo CSV deve conter as colunas 'nr_tombo' e 'Descrica07'."
                    });
                    return;
                }

                // Envia os dados parseados de volta para a thread principal
                self.postMessage({ command: 'parse-complete', payload: results.data });
            },
            error: (error) => {
                // Envia uma mensagem de erro de volta para a thread principal
                self.postMessage({
                    command: 'error',
                    payload: `Erro fatal ao ler o arquivo: ${error.message}`
                });
            }
        });
    }
};