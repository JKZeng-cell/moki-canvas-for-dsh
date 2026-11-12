import {t} from './i18n.js';
import {createNativeWhiteboardSnapshot} from '../vendor/moki/whiteboard/native-whiteboard-model.js';

export function newCanvasSnapshot() {
  const snapshot = createNativeWhiteboardSnapshot();
  let index = 0;
  for (const record of Object.values(snapshot.document.store)) {
    if (record.typeName === 'page') record.name = t('页面 {0}', ++index);
  }
  return snapshot;
}

/** Only used for freshly generated template labels, never for saved/user content. */
export function newMindMapLabel(label: string) {
  const numbered = /^(分支|左侧分支|右侧分支|阶段|一级|二级) (\d+)$/.exec(label);
  if (numbered) return t(`${numbered[1]} {0}`, numbered[2]);
  return t(label);
}
