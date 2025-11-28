import "obsidian";

import { ToolBar } from "../modules/toolbar";
import { ListHelperEvtName } from "../popper/define";

declare module "obsidian" {
  interface Menu {
    dom: HTMLElement;
  }

  interface App {
    commands: any;
  }

  interface Workspace {
    trigger(
      name: typeof ListHelperEvtName,
      toolbar: ToolBar,
      range: EditorRange,
      editor: Editor,
      view: MarkdownView,
    ): void;
  }

  interface Menu {
    addSections(sections: string[]): Menu;

    setParentElement(evt: EventTarget | null): Menu;
  }
}
