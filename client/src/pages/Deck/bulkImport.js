import * as XLSX from 'xlsx';

const HEADER_ALIASES = {
  front: ['term', 'front', 'question', 'word', 'phrase', 'prompt'],
  back: ['definition', 'back', 'answer', 'meaning', 'translation', 'response'],
  example_sentence: ['example', 'example sentence', 'sentence', 'usage'],
  notes: ['notes', 'note', 'hint', 'context'],
};

const normalizeCell = (value) => String(value ?? '').replace(/\r/g, '').trim();

const cleanRows = (rows) => (Array.isArray(rows) ? rows : [])
  .map((row) => (Array.isArray(row) ? row : [row]))
  .map((row) => row.map(normalizeCell))
  .filter((row) => row.some(Boolean));

const normalizeHeader = (value) => normalizeCell(value).toLowerCase();

const detectHeaderMap = (rows) => {
  const firstRow = rows[0] || [];
  const map = {};

  Object.entries(HEADER_ALIASES).forEach(([field, aliases]) => {
    const index = firstRow.findIndex((cell) => aliases.includes(normalizeHeader(cell)));
    if (index >= 0) {
      map[field] = index;
    }
  });

  return map.front != null && map.back != null ? map : null;
};

const splitOnce = (value, separator) => {
  const index = value.indexOf(separator);
  if (index <= 0) return null;
  return [value.slice(0, index), value.slice(index + separator.length)];
};

const detectPasteDelimiter = (lines) => {
  const candidates = [
    { key: 'tab', test: (line) => line.includes('\t') },
    { key: 'pipe', test: (line) => line.includes('|') },
    { key: 'semicolon', test: (line) => line.includes(';') },
    { key: 'comma', test: (line) => line.includes(',') },
    { key: 'dash', test: (line) => line.includes(' - ') },
    { key: 'colon', test: (line) => line.includes(': ') },
  ];

  const scores = candidates.map((candidate) => ({
    key: candidate.key,
    score: lines.reduce((count, line) => count + (candidate.test(line) ? 1 : 0), 0),
  }));

  scores.sort((a, b) => b.score - a.score);
  return scores[0]?.score ? scores[0].key : 'pairs';
};

const splitPasteLine = (line, delimiter) => {
  switch (delimiter) {
    case 'tab':
      return line.split(/\t+/);
    case 'pipe':
      return line.split(/\s*\|\s*/);
    case 'semicolon':
      return line.split(/\s*;\s*/);
    case 'comma':
      return line.split(/\s*,\s*/);
    case 'dash': {
      const parts = splitOnce(line, ' - ');
      return parts || [line];
    }
    case 'colon': {
      const parts = splitOnce(line, ': ');
      return parts || [line];
    }
    default:
      return [line];
  }
};

const normalizeCards = (rows) => {
  const cleanedRows = cleanRows(rows);
  if (!cleanedRows.length) {
    throw new Error('No rows were found to import.');
  }

  const headerMap = detectHeaderMap(cleanedRows);
  const dataRows = headerMap ? cleanedRows.slice(1) : cleanedRows;

  const cards = dataRows
    .map((row) => {
      if (headerMap) {
        return {
          front: normalizeCell(row[headerMap.front]),
          back: normalizeCell(row[headerMap.back]),
          example_sentence: normalizeCell(row[headerMap.example_sentence]),
          notes: normalizeCell(row[headerMap.notes]),
        };
      }

      const [front = '', back = '', example_sentence = '', notes = ''] = row;
      return {
        front,
        back,
        example_sentence,
        notes,
      };
    })
    .filter((card) => card.front && card.back);

  if (!cards.length) {
    throw new Error('No valid term/definition pairs were found.');
  }

  return cards;
};

export const parseCardsFromPaste = (text, selectedDelimiter = 'auto') => {
  const normalizedText = String(text || '').trim();
  if (!normalizedText) {
    throw new Error('Paste some text first.');
  }

  const lines = normalizedText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    throw new Error('Paste some text first.');
  }

  const delimiter = selectedDelimiter === 'auto'
    ? detectPasteDelimiter(lines)
    : selectedDelimiter;

  if (delimiter === 'pairs') {
    if (lines.length < 2) {
      throw new Error('Paste at least two lines to build cards.');
    }

    const pairRows = [];
    for (let index = 0; index < lines.length; index += 2) {
      const front = lines[index];
      const back = lines[index + 1];
      if (front && back) {
        pairRows.push([front, back]);
      }
    }
    return normalizeCards(pairRows);
  }

  const rows = lines.map((line) => splitPasteLine(line, delimiter));
  return normalizeCards(rows);
};

export const parseCardsFromFile = async (file) => {
  if (!file) {
    throw new Error('Choose a file first.');
  }

  const extension = String(file.name || '')
    .split('.')
    .pop()
    ?.toLowerCase();

  if (extension === 'xlsx' || extension === 'xls' || extension === 'csv') {
    const readType = extension === 'csv' ? 'string' : 'array';
    const source = extension === 'csv' ? await file.text() : await file.arrayBuffer();
    const workbook = XLSX.read(source, { type: readType });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error('This spreadsheet is empty.');
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      blankrows: false,
      raw: false,
    });
    return normalizeCards(rows);
  }

  const text = await file.text();
  return parseCardsFromPaste(text, 'auto');
};
