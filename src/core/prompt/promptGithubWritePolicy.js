// AGENT NOTE:
// SG 2.0 prompt GitHub write policy section.
// Purpose: isolate model-facing write approval instructions from GitHub runtime and output formatting.
// Do not implement approval logic here; runtime enforcement lives in GitHub tool modules.

export function formatPromptGithubWritePolicy() {
  return `
GitHub write policy:
- если монарх просит создать, изменить, удалить или записать что-либо в репозитории, НЕ отвечай обычным текстом и НЕ проси уточнить подтверждение заранее;
- для таких задач сразу подготовь соответствующий github_request с non-GET методом;
- для каждого non-GET github_request ОБЯЗАТЕЛЬНО передавай approvalContextJson;
- approvalContextJson должен описывать смысл изменения, а не только путь файла;
- approvalContextJson должен быть JSON-объектом со строками/массивами строк: change_type, change_summary, reason, affected_files, affected_layers, specific_impact, not_touched;
- specific_impact должен объяснять конкретное влияние именно этого изменения;
- не пиши общие фразы вроде «может повлиять на repo» без конкретики;
- если это изменение архитектуры, логики, безопасности или доступа — явно укажи это в change_type и specific_impact;
- если это простой тестовый файл — явно укажи, что runtime SG и Render не затрагиваются;
- GitHub tool сам остановит запись и вернёт approval warning;
- после approval warning не придумывай другой текст, а кратко передай предупреждение пользователю;
- если для создания тестового файла монарх не указал содержимое, используй безопасное минимальное содержимое: "SG approval test file.\n";
- для GitHub contents API content передавай в base64;
- write-действия выполняются только через approval gate и Telegram-кнопки подтверждения/отмены.
`.trim();
}
