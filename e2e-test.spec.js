const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Full application workflow', () => {
  const csvPath = path.resolve(__dirname, 'test-data.csv');
  const ITEM_TO_FIND = 'T003';
  const ITEM_TO_TRANSFER = 'T005';
  const NEW_RESPONSIBLE = 'Novo Responsavel';

  test('should upload CSV, perform actions, and restore session', async ({ page }) => {
    // 1. Navigate to the application
    await page.goto('file://' + path.resolve(__dirname, 'index.html'));

    // 2. Upload the CSV file
    await page.setInputFiles('input#csvFileInput', csvPath);

    // 3. Verify initial state after upload
    await expect(page.locator('#mainContent')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#file-status')).toHaveText('60 itens carregado(s) com sucesso!');
    await expect(page.locator('#mainTableBody tr')).toHaveCount(50); // 50 items per page

    // 4. Search for an item and mark it as "Encontrado"
    await page.locator('#tomboInput').fill(ITEM_TO_FIND);
    await page.locator('#loadButton').click();

    // Verify item details are displayed
    await expect(page.locator('#itemDetailsSection')).toBeVisible();
    await expect(page.locator('#itemTombo')).toHaveText(`Nº Tombo: ${ITEM_TO_FIND}`);
    await expect(page.locator('#itemStatus')).toHaveText('Status: Pendente');

    // Click "Encontrado" action
    await page.locator('button[data-action="found"]').click();

    // Verify status update in details and table
    await expect(page.locator('#itemStatus')).toHaveText('Status: Encontrado');
    const foundRow = page.locator(`#mainTableBody tr[data-tombo='${ITEM_TO_FIND}']`);
    await expect(foundRow.locator('td .status-badge')).toHaveText('Encontrado');
    await expect(foundRow).toHaveClass(/bg-green-200/);

    // 5. Search for another item and perform a transfer
    await page.locator('#tomboInput').fill(ITEM_TO_TRANSFER);
    await page.locator('#loadButton').click();

    // Handle the prompt for the new responsible person
    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('Digite o nome do novo responsável:');
      await dialog.accept(NEW_RESPONSIBLE);
    });

    // Click "Transferir" action
    await page.locator('button[data-action="transfer"]').click();

    // Verify status and responsible update
    await expect(page.locator('#itemStatus')).toHaveText('Status: Transferência Solicitada');
    await expect(page.locator('#itemResponsible')).toHaveText(`Responsável: ${NEW_RESPONSIBLE}`);
    const transferredRow = page.locator(`#mainTableBody tr[data-tombo='${ITEM_TO_TRANSFER}']`);
    await expect(transferredRow.locator('td').nth(2)).toHaveText(NEW_RESPONSIBLE);
    await expect(transferredRow.locator('td .status-badge')).toHaveText('Transferência Solicitada');

    // 6. Test session persistence
    await page.reload();

    // Verify restore notification is visible
    await expect(page.locator('#restore-notification')).toBeVisible();

    // Click "Yes" to restore
    await page.locator('#restore-yes').click();
    await expect(page.locator('#restore-notification')).toBeHidden();

    // 7. Verify the state was correctly restored
    await expect(page.locator('#file-status')).toHaveText('Sessão anterior restaurada com 60 itens.');

    // Check the first item ("Encontrado")
    const restoredFoundRow = page.locator(`#mainTableBody tr[data-tombo='${ITEM_TO_FIND}']`);
    await expect(restoredFoundRow.locator('td .status-badge')).toHaveText('Encontrado');

    // Check the second item ("Transferido")
    const restoredTransferredRow = page.locator(`#mainTableBody tr[data-tombo='${ITEM_TO_TRANSFER}']`);
    await expect(restoredTransferredRow.locator('td').nth(2)).toHaveText(NEW_RESPONSIBLE);
    await expect(restoredTransferredRow.locator('td .status-badge')).toHaveText('Transferência Solicitada');

    // 8. Verify pagination is still working
    await expect(page.locator('#mainTableBody tr')).toHaveCount(50);
    await page.locator('button:text("Próximo")').click();
    await expect(page.locator('#mainTableBody tr')).toHaveCount(10); // 10 items on the second page

    // 9. Test export functionality
    const [ download ] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('#exportButton').click()
    ]);

    // Verify a download was initiated
    expect(download.suggestedFilename()).toMatch(/relatorio_patrimonio_.*\.csv/);

    // Optional: Check content of downloaded file
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    const csvContent = Buffer.concat(chunks).toString('utf-8');

    expect(csvContent).toContain('nr_tombo,Descrica07,nome,status,original_responsavel');
    expect(csvContent).toContain(`${ITEM_TO_FIND},Projetor Epson,Bob,Encontrado,Bob`);
    // PapaParse will escape the quote in "Monitor LG 24"" by wrapping the field in quotes, so we expect """
    expect(csvContent).toContain(`${ITEM_TO_TRANSFER},"Monitor LG 24""",${NEW_RESPONSIBLE},Transferência Solicitada,Charlie`);
  });
});