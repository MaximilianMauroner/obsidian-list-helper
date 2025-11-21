import { EditorView } from "@codemirror/view";
import { MarkdownView, Plugin } from "obsidian";

import { preserveEmojiOnNewLine } from "./modules/listEmojiPreserve";
import { ToolBarExtension } from "./modules/toolbar";

export default class MiniToolbar extends Plugin {
  async onload() {
    console.log("loading MiniToolbar");

    this.registerEditorExtension(ToolBarExtension(this.app));

    // Register command for emoji new line selection
    this.addCommand({
      id: "emoji-new-line-selection",
      name: "Emoji new line selection",
      editorCallback: (editor, view) => {
        if (!(view instanceof MarkdownView)) return;

        // Get the CodeMirror editor view from the Obsidian editor
        const cmEditor = (editor as any).cm as EditorView;
        if (!cmEditor) {
          return;
        }

        preserveEmojiOnNewLine(cmEditor);
      },
    });
  }
}
