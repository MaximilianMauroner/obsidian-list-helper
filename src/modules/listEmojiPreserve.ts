// @ts-nocheck
import { syntaxTree, tokenClassNodeProp } from "@codemirror/language";
import {
  EditorSelection,
  EditorState,
  StateEffect,
  StateField,
} from "@codemirror/state";
import {
  EditorView,
  PluginValue,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";

/**
 * State effect to store the emoji that should be preserved on the next line
 */
const preserveEmojiEffect = StateEffect.define<string | null>();

/**
 * State field to track emoji preservation state
 */
const emojiPreserveState = StateField.define<string | null>({
  create: () => null,
  update: (value, tr) => {
    for (const effect of tr.effects) {
      if (effect.is(preserveEmojiEffect)) {
        // If effect value is null, clear; otherwise set it
        return effect.value;
      }
    }
    // Don't clear automatically - let the plugin clear it after insertion
    return value;
  },
});

/**
 * Checks if we're currently in a list context (bullet or numbered)
 */
const isInList = (state: EditorState, pos: number): boolean => {
  const line = state.doc.lineAt(pos);
  const linePos = line.from;
  const syntaxNode = syntaxTree(state).resolveInner(linePos + 1);

  if (!syntaxNode) return false;

  // @ts-ignore
  let nodeProps: string = syntaxNode.type.prop(tokenClassNodeProp);

  if (!nodeProps) return false;

  // Check if we're in a list (bullet, numbered, or task list)
  return (
    nodeProps.contains("formatting-list") ||
    nodeProps.contains("hmd-list-indent") ||
    nodeProps.contains("formatting-list-ul") ||
    nodeProps.contains("formatting-list-ol")
  );
};

/**
 * Extracts blockquote prefix from a line (e.g., "> ", "> > ", etc.)
 * Returns the prefix string if found, empty string otherwise
 */
const extractBlockquotePrefix = (lineText: string): string => {
  const blockquoteMatch = lineText.match(/^(>\s*)+/);
  return blockquoteMatch ? blockquoteMatch[0] : "";
};

/**
 * Extracts the emoji from the start of a list item line
 * Returns the emoji string (with spacing) if found, null otherwise
 */
const extractEmojiFromLine = (lineText: string): string | null => {
  // Extract blockquote prefix if present
  const blockquotePrefix = extractBlockquotePrefix(lineText);
  const textAfterBlockquote = lineText.substring(blockquotePrefix.length);

  // Remove the bullet/number markdown (e.g., "- ", "* ", "1. ", "- [ ] ")
  // Match: optional spaces, then "- " or "* " or number with "." or "- [ ]" or "- [x]"
  const listMarkerMatch = textAfterBlockquote.match(
    /^\s*[-*]\s+|^\s*\d+\.\s+|^\s*[-*]\s*\[[ x]\]\s*/,
  );

  if (!listMarkerMatch) {
    return null;
  }

  // Get text after the list marker
  const textAfterMarker = textAfterBlockquote.substring(
    listMarkerMatch[0].length,
  );

  if (!textAfterMarker.trim()) {
    return null;
  }

  // Try to match an emoji at the start (including optional leading spaces)
  // Match emoji and any trailing space
  const emojiMatch = textAfterMarker.match(
    /^(\s*)([\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}\u{1FA00}-\u{1FAFF}\u{1F680}-\u{1F6FF}\u{24C2}-\u{1F251}\u{1F600}-\u{1F64F}\u{1F910}-\u{1F96F}\u{1F980}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{1F004}\u{1F0CF}\u{1F170}-\u{1F251}]+)(\s*)/u,
  );

  if (emojiMatch) {
    // Return emoji with the same spacing as before it and a space after
    const result = emojiMatch[1] + emojiMatch[2] + (emojiMatch[3] || " ");
    return result;
  }

  return null;
};

/**
 * View plugin to handle emoji insertion after Enter
 */
class EmojiPreservePlugin implements PluginValue {
  private lastLineCount: number = 0;
  private pendingEmoji: string | null = null;

  constructor(private view: EditorView) {
    this.lastLineCount = view.state.doc.lines;
  }

  update(update: ViewUpdate) {
    const preservedEmoji = update.state.field(emojiPreserveState);

    if (preservedEmoji) {
      this.pendingEmoji = preservedEmoji;
    }

    // Check if a newline was added (line count increased)
    if (update.docChanged && this.pendingEmoji) {
      const currentLineCount = update.state.doc.lines;

      if (currentLineCount > this.lastLineCount) {
        // A new line was added
        const selection = update.state.selection.main;
        const cursorPos = selection.from;

        // Check if cursor is on the new line
        const line = update.state.doc.lineAt(cursorPos);

        // Only process if we're in a list and on a new line
        if (isInList(update.state, cursorPos)) {
          const newLineText = line.text;
          const blockquotePrefix = extractBlockquotePrefix(newLineText);
          const textAfterBlockquote = newLineText.substring(
            blockquotePrefix.length,
          );
          const listMarkerMatch = textAfterBlockquote.match(
            /^\s*[-*]\s+|^\s*\d+\.\s+|^\s*[-*]\s*\[[ x]\]\s*/,
          );

          if (listMarkerMatch) {
            const fullPrefix = blockquotePrefix + listMarkerMatch[0];
            const insertPos = line.from + fullPrefix.length;
            const textAfterMarker = textAfterBlockquote.substring(
              listMarkerMatch[0].length,
            );

            // Only insert if the new line is empty (no content after the marker)
            if (!textAfterMarker.trim() && !extractEmojiFromLine(newLineText)) {
              // Use setTimeout to ensure Obsidian has finished processing
              setTimeout(() => {
                if (!this.view.dom.isConnected) {
                  return;
                }

                const currentState = this.view.state;
                const currentLine = currentState.doc.lineAt(cursorPos);
                const currentLineText = currentLine.text;
                const currentBlockquotePrefix =
                  extractBlockquotePrefix(currentLineText);
                const currentTextAfterBlockquote = currentLineText.substring(
                  currentBlockquotePrefix.length,
                );
                const currentListMarker = currentTextAfterBlockquote.match(
                  /^\s*[-*]\s+|^\s*\d+\.\s+|^\s*[-*]\s*\[[ x]\]\s*/,
                );

                if (
                  currentListMarker &&
                  !extractEmojiFromLine(currentLineText)
                ) {
                  const currentFullPrefix =
                    currentBlockquotePrefix + currentListMarker[0];
                  const currentInsertPos =
                    currentLine.from + currentFullPrefix.length;
                  const currentTextAfter = currentTextAfterBlockquote.substring(
                    currentListMarker[0].length,
                  );

                  // Double-check the line is still empty
                  if (!currentTextAfter.trim() && this.pendingEmoji) {
                    this.view.dispatch({
                      changes: {
                        from: currentInsertPos,
                        to: currentInsertPos,
                        insert: this.pendingEmoji,
                      },
                      selection: EditorSelection.cursor(
                        currentInsertPos + this.pendingEmoji.length,
                      ),
                      effects: preserveEmojiEffect.of(null), // Clear after use
                    });
                    this.pendingEmoji = null;
                  }
                }
              }, 10);
            }
          }
        }
      }

      this.lastLineCount = currentLineCount;
    }
  }
}

/**
 * Extracts the list marker (indentation + marker) from a line
 * Returns the marker string if found, null otherwise
 * Includes blockquote prefix if present
 */
const extractListMarker = (lineText: string): string | null => {
  // Extract blockquote prefix if present
  const blockquotePrefix = extractBlockquotePrefix(lineText);
  const textAfterBlockquote = lineText.substring(blockquotePrefix.length);

  // Match: optional spaces, then "- " or "* " or number with "." or "- [ ]" or "- [x]"
  const listMarkerMatch = textAfterBlockquote.match(
    /^(\s*[-*]\s+|\s*\d+\.\s+|\s*[-*]\s*\[[ x]\]\s*)/,
  );
  return listMarkerMatch ? blockquotePrefix + listMarkerMatch[1] : null;
};

/**
 * Core logic to preserve emoji on new line in list context
 * Can be called from keyboard handler or Obsidian command
 * @param view The CodeMirror EditorView
 * @returns true if emoji was preserved, false otherwise
 */
export const preserveEmojiOnNewLine = (view: EditorView): boolean => {
  const state = view.state;
  const selection = state.selection.main;
  const pos = selection.from;

  const line = state.doc.lineAt(pos);
  const lineText = line.text;

  // Extract list marker from current line (this handles blockquotes too)
  // We check for list marker first, as it's more reliable than syntax tree
  // for blockquoted lists
  const listMarker = extractListMarker(lineText);
  if (!listMarker) {
    return false;
  }

  // Extract emoji from current line
  const emoji = extractEmojiFromLine(lineText);

  if (!emoji) {
    return false;
  }

  // Insert newline with list marker and emoji immediately
  const newLineContent = "\n" + listMarker + emoji;
  const newCursorPos = pos + newLineContent.length;

  view.dispatch({
    changes: {
      from: pos,
      to: pos,
      insert: newLineContent,
    },
    selection: EditorSelection.cursor(newCursorPos),
  });

  return true;
};

/**
 * Handles Enter key press in list context
 * Stores the emoji to be preserved on the next line
 */
const handleEnterKey = (event: KeyboardEvent, view: EditorView): boolean => {
  const result = preserveEmojiOnNewLine(view);
  if (result) {
    // Prevent default Ctrl+Enter behavior since we're handling it
    event.preventDefault();
  }
  return result;
};

/**
 * Creates an extension that preserves emojis when pressing Enter in list contexts
 */
export const listEmojiPreserveExtension = () => {
  const handlers = EditorView.domEventHandlers({
    keydown: (event: KeyboardEvent, view: EditorView) => {
      // Trigger on Meta+Shift+Enter (Cmd+Shift+Enter on Mac, Ctrl+Shift+Enter on Windows/Linux)
      if (
        event.key === "Enter" &&
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        !event.altKey
      ) {
        return handleEnterKey(event, view);
      }
      return false;
    },
  });

  return [
    emojiPreserveState,
    ViewPlugin.fromClass(EmojiPreservePlugin),
    handlers,
  ];
};
