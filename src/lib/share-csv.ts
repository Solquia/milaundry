/**
 * Hands a CSV to the owner on whichever platform they are on.
 *
 * In a browser it downloads as a file, ready for Excel. On a phone it goes
 * to the share sheet as text — Gmail, Messenger or Notes take it as is, and
 * pasting it into Google Sheets splits the columns. A real file attachment
 * on a phone needs `expo-sharing`, a native module an over-the-air update
 * cannot deliver, so it waits for the next store build.
 */
import { Platform, Share } from 'react-native';

export async function shareCsv(filename: string, csv: string): Promise<void> {
  if (Platform.OS === 'web') {
    // The BOM makes Excel read ₱ and ñ as UTF-8 instead of mojibake.
    const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return;
  }
  await Share.share({ title: filename, message: csv });
}
