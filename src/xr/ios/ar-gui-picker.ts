import {
  AdvancedDynamicTexture,
  Rectangle,
  TextBlock,
  StackPanel,
  Button,
  Image,
  Control,
} from "@babylonjs/gui";
import type { Scene } from "@babylonjs/core";

export type GuiPickerItem = {
  id: string;
  name: string;
  iconUrl: string | null;
};

export type ArGuiPicker = {
  update: (options: {
    items: GuiPickerItem[];
    activeId: string | null;
    statusText: string;
    floorReady: boolean;
    floorScanComplete?: boolean;
  }) => void;
  dispose: () => void;
};

/** Fixed action bar — two full-width rows (StackPanel clipped at 88px on iOS). */
export const AR_GUI_ACTION_PAD_PX = 8;
export const AR_GUI_ACTION_BTN_PX = 36;
export const AR_GUI_ACTION_GAP_PX = 6;
export const AR_GUI_ACTION_BAR_PX =
  AR_GUI_ACTION_PAD_PX * 2 +
  AR_GUI_ACTION_BTN_PX * 2 +
  AR_GUI_ACTION_GAP_PX;
export const AR_GUI_PANEL_PX = 196;

export function createArGuiPicker(
  scene: Scene,
  callbacks: {
    onSelect: (id: string) => void;
    onDownloadLog: () => void;
    onExit: () => void;
  }
): ArGuiPicker {
  const adt = AdvancedDynamicTexture.CreateFullscreenUI("arPicker", true, scene);
  adt.idealWidth = 360;
  adt.rootContainer.background = "transparent";
  adt.rootContainer.alpha = 1;

  const actionBar = new Rectangle("arGuiActionBar");
  actionBar.width = "100%";
  actionBar.height = `${AR_GUI_ACTION_BAR_PX}px`;
  actionBar.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  actionBar.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  actionBar.thickness = 0;
  actionBar.background = "rgba(12, 24, 48, 0.94)";
  actionBar.cornerRadius = 0;
  adt.addControl(actionBar);

  const logBtn = Button.CreateSimpleButton("arGuiLog", "Download log");
  logBtn.width = "92%";
  logBtn.height = `${AR_GUI_ACTION_BTN_PX}px`;
  logBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  logBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  logBtn.top = `${AR_GUI_ACTION_PAD_PX}px`;
  logBtn.color = "white";
  logBtn.background = "rgba(255,255,255,0.12)";
  logBtn.onPointerUpObservable.add(() => callbacks.onDownloadLog());
  actionBar.addControl(logBtn);

  const exitBtn = Button.CreateSimpleButton("arGuiExit", "Exit AR");
  exitBtn.width = "92%";
  exitBtn.height = `${AR_GUI_ACTION_BTN_PX}px`;
  exitBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  exitBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  exitBtn.top = `${AR_GUI_ACTION_PAD_PX + AR_GUI_ACTION_BTN_PX + AR_GUI_ACTION_GAP_PX}px`;
  exitBtn.color = "white";
  exitBtn.background = "rgba(255,255,255,0.12)";
  exitBtn.onPointerUpObservable.add(() => callbacks.onExit());
  actionBar.addControl(exitBtn);

  const panel = new Rectangle("arGuiPanel");
  panel.width = "100%";
  panel.height = `${AR_GUI_PANEL_PX}px`;
  panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  panel.top = `-${AR_GUI_ACTION_BAR_PX}px`;
  panel.thickness = 0;
  panel.background = "rgba(12, 24, 48, 0.92)";
  panel.cornerRadius = 16;
  panel.paddingTop = "8px";
  adt.addControl(panel);

  const stack = new StackPanel("arGuiStack");
  stack.width = "100%";
  stack.height = "100%";
  stack.isVertical = true;
  stack.paddingTop = "4px";
  stack.paddingBottom = "8px";
  stack.paddingLeft = "12px";
  stack.paddingRight = "12px";
  panel.addControl(stack);

  const title = new TextBlock("arGuiTitle", "Finding the floor…");
  title.height = "22px";
  title.color = "white";
  title.fontSize = 16;
  title.fontWeight = "600";
  title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  stack.addControl(title);

  const status = new TextBlock("arGuiStatus", "");
  status.height = "28px";
  status.color = "#b0c4de";
  status.fontSize = 13;
  status.textWrapping = true;
  status.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  stack.addControl(status);

  const tileRow = new StackPanel("arGuiTiles");
  tileRow.height = "64px";
  tileRow.isVertical = false;
  tileRow.spacing = 8;
  stack.addControl(tileRow);

  const update = (options: {
    items: GuiPickerItem[];
    activeId: string | null;
    statusText: string;
    floorReady: boolean;
    floorScanComplete?: boolean;
  }) => {
    const scanComplete = options.floorScanComplete === true;
    title.text = scanComplete
      ? options.floorReady
        ? "Choose a model"
        : "Floor not detected yet"
      : "Scanning the floor…";
    status.text = options.statusText;

    tileRow.children.slice().forEach((c) => tileRow.removeControl(c));

    if (!scanComplete) return;

    for (const item of options.items) {
      const btn = Button.CreateSimpleButton(`tile-${item.id}`, "");
      btn.width = "56px";
      btn.height = "56px";
      btn.thickness = options.activeId === item.id ? 2 : 0;
      btn.color = "#42a5f5";
      btn.background = "rgba(255,255,255,0.08)";
      btn.cornerRadius = 12;

      const img = new Image(`icon-${item.id}`, item.iconUrl);
      img.width = "38px";
      img.height = "38px";
      img.stretch = Image.STRETCH_UNIFORM;
      btn.addControl(img);

      const id = item.id;
      btn.onPointerUpObservable.add(() => callbacks.onSelect(id));
      tileRow.addControl(btn);
    }
  };

  return {
    update,
    dispose: () => adt.dispose(),
  };
}
