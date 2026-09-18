import { TEMPLATE_CIPHER, TITLE } from './ids';
import { formatInventoryNumber, stageSubtitleFromSurveyStage } from './text';
import type { ReportIeiFillData } from './types';
import {
  removeParagraphOnly,
  replaceExactTextInWordTextNodes,
  replaceParagraphTextKeepFormatting,
} from './xml-text';

export function fillReportIeiTitle(xml: string, data: ReportIeiFillData): string {
  let out = xml;
  out = replaceParagraphTextKeepFormatting(out, TITLE.objectName, data.objectName);
  out = replaceParagraphTextKeepFormatting(
    out,
    TITLE.stageSubtitle,
    stageSubtitleFromSurveyStage(data.surveyStage),
  );
  out = removeParagraphOnly(out, TITLE.program71Note);
  out = replaceParagraphTextKeepFormatting(out, TITLE.cipher, data.reportCipher);
  out = replaceParagraphTextKeepFormatting(out, TITLE.volume, data.volume);
  out = replaceParagraphTextKeepFormatting(
    out,
    TITLE.inventoryNumber,
    formatInventoryNumber(data.inventoryNumber),
  );

  // Только <w:t>, не весь абзац: иначе режется textbox/штамп. Колонтитулы сюда не попадают.
  if (data.reportCipher && data.reportCipher !== TEMPLATE_CIPHER) {
    out = replaceExactTextInWordTextNodes(out, TEMPLATE_CIPHER, data.reportCipher);
  }

  return out;
}
