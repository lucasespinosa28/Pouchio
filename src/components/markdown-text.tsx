/**
 * Minimal Markdown renderer for the small subset the local LLM emits — headings,
 * bullet and numbered lists, bold spans, and paragraphs. Avoids pulling in a
 * full Markdown dependency for what is short, model-generated text.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

// Split a line into plain strings and **bold** segments.
function renderInline(text: string, keyBase: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex = /(\*\*|__)(.+?)\1/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(
      <ThemedText key={`${keyBase}-b${i}`} style={styles.bold}>
        {match[2]}
      </ThemedText>,
    );
    last = match.index + match[0].length;
    i++;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function MarkdownText({ content }: { content: string }) {
  const lines = content.replace(/\r/g, '').split('\n');
  const blocks: ReactNode[] = [];

  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) return; // blank line — spacing comes from the container gap
    const key = `l${idx}`;

    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push(
        <ThemedText key={key} type="smallBold" style={styles.heading}>
          {renderInline(heading[1], key)}
        </ThemedText>,
      );
      return;
    }

    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    const numbered = /^(\d+)[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const marker = bullet ? '•' : `${numbered![1]}.`;
      const rest = bullet ? bullet[1] : numbered![2];
      blocks.push(
        <View key={key} style={styles.row}>
          <ThemedText type="default" style={styles.marker}>
            {marker}
          </ThemedText>
          <ThemedText type="default" style={styles.itemText}>
            {renderInline(rest, key)}
          </ThemedText>
        </View>,
      );
      return;
    }

    blocks.push(
      <ThemedText key={key} type="default" style={styles.paragraph}>
        {renderInline(line, key)}
      </ThemedText>,
    );
  });

  return <View style={styles.container}>{blocks}</View>;
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  heading: {
    marginTop: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  marker: {
    minWidth: 16,
  },
  itemText: {
    flex: 1,
    lineHeight: 22,
  },
  paragraph: {
    lineHeight: 22,
  },
  bold: {
    fontWeight: '700',
  },
});
