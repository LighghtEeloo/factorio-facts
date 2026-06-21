import {
  ArrowRight,
  Boxes,
  Check,
  ExternalLink,
  GripVertical,
  Import,
  Network,
  PackageOpen,
  Plus,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";
import type { FactorioLabIcon } from "../../factoriolab/types";
import type {
  IngredientPrototype,
  ProductPrototype,
  RecipePrototype,
} from "../../factorio/prototypes";
import {
  getIconIdForItem,
  getRecipeMetadata,
  type RecipeExplorerData,
} from "../data/factoriolab";
import {
  getBeaconModuleCapacity,
  getBeaconModuleOptions,
  getBeaconOptions,
  getDefaultBeaconModuleSettings,
  getDefaultBeaconSettings,
  getDefaultMachineModuleSettings,
  getFactorySettingsSummaryCount,
  getMachineModuleCapacity,
  getRecipeModuleOptions,
  getRecipeSelectedMachineId,
  sanitizeBeaconSettings,
  sanitizeModuleSettings,
  type LayoutFactoryItemOption,
} from "../layout-factory-settings";
import type {
  LayoutBeaconSettings,
  LayoutModuleSettings,
  LayoutReorderPlacement,
  RecipeLayout,
  RecipeLayoutEntry,
} from "../types";
import { IconSprite } from "./IconSprite";
import { RecipeIcon } from "./RecipeIcon";
import { RecipeMetaPills } from "./RecipeMetaPills";

interface LayoutWorkspaceProps {
  data: RecipeExplorerData;
  focusedLayoutId: string;
  layouts: RecipeLayout[];
  onCreateLayout(): void;
  onDeleteLayout(layoutId: string): void;
  onImportLayout(layoutId: string, value: string): boolean;
  onOpenLayoutGraph(layoutId: string): void;
  onRecipeBeaconsChange(
    layoutId: string,
    entryId: string,
    beacons: LayoutBeaconSettings[],
  ): void;
  onRecipeMachineChange(layoutId: string, entryId: string, machineId: string): void;
  onRecipeModulesChange(
    layoutId: string,
    entryId: string,
    modules: LayoutModuleSettings[],
  ): void;
  onRecipeProductionSizeChange(
    layoutId: string,
    entryId: string,
    productionSize: number,
  ): void;
  onRemoveRecipeFromLayout(layoutId: string, entryId: string): void;
  onRenameLayout(layoutId: string, name: string): void;
  onReorderRecipeInLayout(
    layoutId: string,
    sourceEntryId: string,
    targetEntryId: string,
    placement: LayoutReorderPlacement,
  ): void;
  onSelectItem(itemId: string): void;
}

export function LayoutWorkspace({
  data,
  focusedLayoutId,
  layouts,
  onCreateLayout,
  onDeleteLayout,
  onImportLayout,
  onOpenLayoutGraph,
  onRecipeBeaconsChange,
  onRecipeMachineChange,
  onRecipeModulesChange,
  onRecipeProductionSizeChange,
  onRemoveRecipeFromLayout,
  onRenameLayout,
  onReorderRecipeInLayout,
  onSelectItem,
}: LayoutWorkspaceProps) {
  const [draggedEntryId, setDraggedEntryId] = useState<string | null>(null);
  const [entryDropTarget, setEntryDropTarget] = useState<{
    entryId: string;
    placement: LayoutReorderPlacement;
  } | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importDraft, setImportDraft] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const focusedLayout =
    layouts.find((layout) => layout.id === focusedLayoutId) ?? layouts[0] ?? null;
  const selectedEntry =
    focusedLayout?.entries.find((entry) => entry.id === selectedEntryId) ??
    focusedLayout?.entries[0] ??
    null;
  const selectedRecipe = selectedEntry
    ? data.recipeById.get(selectedEntry.recipeId) ?? null
    : null;
  const title = focusedLayout?.name.trim() || "Untitled layout";

  useEffect(() => {
    if (!focusedLayout?.entries.length) {
      setSelectedEntryId(null);
      return;
    }

    if (!focusedLayout.entries.some((entry) => entry.id === selectedEntryId)) {
      setSelectedEntryId(focusedLayout.entries[0]?.id ?? null);
    }
  }, [focusedLayout?.entries, focusedLayout?.id, selectedEntryId]);

  useEffect(() => {
    if (!draggedEntryId || !focusedLayout) {
      return;
    }

    const activeEntryId = draggedEntryId;
    const activeLayoutId = focusedLayout.id;

    function handlePointerMove(event: PointerEvent) {
      const row = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>("[data-layout-editor-entry]");
      const targetEntryId = row?.dataset.layoutEditorEntry;

      if (!row || !targetEntryId || targetEntryId === activeEntryId) {
        setEntryDropTarget(null);
        return;
      }

      const rect = row.getBoundingClientRect();
      const placement: LayoutReorderPlacement =
        event.clientY < rect.top + rect.height / 2 ? "before" : "after";

      setEntryDropTarget({ entryId: targetEntryId, placement });
    }

    function handlePointerUp() {
      if (entryDropTarget) {
        onReorderRecipeInLayout(
          activeLayoutId,
          activeEntryId,
          entryDropTarget.entryId,
          entryDropTarget.placement,
        );
      }

      setDraggedEntryId(null);
      setEntryDropTarget(null);
    }

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);

    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    };
  }, [draggedEntryId, entryDropTarget, focusedLayout, onReorderRecipeInLayout]);

  if (!focusedLayout) {
    return (
      <section className="layout-workspace">
        <div className="workspace-empty app-panel">
          <Boxes size={40} aria-hidden="true" />
          <div>
            <h1>No layouts</h1>
            <span>No layout selected</span>
          </div>
          <button className="primary-action-button" type="button" onClick={onCreateLayout}>
            <Plus size={18} aria-hidden="true" />
            New layout
          </button>
        </div>
      </section>
    );
  }

  function openImportDialog() {
    setImportDraft("");
    setImportError(null);
    setIsImportDialogOpen(true);
  }

  function closeImportDialog() {
    setIsImportDialogOpen(false);
    setImportDraft("");
    setImportError(null);
  }

  function submitImport() {
    if (!focusedLayout) {
      return;
    }

    const value = importDraft.trim();

    if (!value) {
      setImportError("Paste a layout JSON string.");
      return;
    }

    if (onImportLayout(focusedLayout.id, value)) {
      closeImportDialog();
      return;
    }

    setImportError("That string is not a factorio-facts layout export.");
  }

  return (
    <section className="layout-workspace">
      <header className="layout-workspace__header app-panel">
        <div className="layout-workspace__title">
          <Boxes size={28} aria-hidden="true" />
          <label className="layout-title-field">
            <span className="layout-title-field__meta">
              <span>Layout</span>
              <span className="layout-workspace__count">
                {focusedLayout.entries.length}{" "}
                {focusedLayout.entries.length === 1 ? "recipe" : "recipes"}
              </span>
            </span>
            <input
              aria-label="Layout name"
              placeholder="Untitled layout"
              value={focusedLayout.name}
              onChange={(event) => onRenameLayout(focusedLayout.id, event.target.value)}
            />
          </label>
        </div>
        <div className="layout-workspace__actions">
          {!focusedLayout.entries.length ? (
            <>
              <button
                aria-label="Import layout"
                className="icon-button"
                data-tooltip="Import layout"
                type="button"
                onClick={openImportDialog}
              >
                <Import size={18} aria-hidden="true" />
              </button>
              <button
                aria-label="Delete layout"
                className="icon-button"
                data-tooltip="Delete layout"
                type="button"
                onClick={() => onDeleteLayout(focusedLayout.id)}
              >
                <Trash2 size={18} aria-hidden="true" />
              </button>
            </>
          ) : (
            <button
              aria-label="Open layout graph"
              className="icon-button"
              data-tooltip="Open graph"
              type="button"
              onClick={() => onOpenLayoutGraph(focusedLayout.id)}
            >
              <Network size={18} aria-hidden="true" />
            </button>
          )}
        </div>
      </header>

      <div className="layout-workspace__body">
        <section className="layout-editor app-panel" aria-label={`${title} recipes`}>
          <div className="layout-editor__recipes">
            {focusedLayout.entries.length ? (
              focusedLayout.entries.map((entry, index) => {
                const recipe = data.recipeById.get(entry.recipeId);

                if (!recipe) {
                  return null;
                }

                return (
                  <LayoutEditorRecipeRow
                    data={data}
                    dragging={draggedEntryId === entry.id}
                    dropPlacement={
                      entryDropTarget?.entryId === entry.id
                        ? entryDropTarget.placement
                        : null
                    }
                    entry={entry}
                    index={index}
                    key={entry.id}
                    recipe={recipe}
                    selected={selectedEntry?.id === entry.id}
                    onDragStart={() => {
                      setDraggedEntryId(entry.id);
                      setEntryDropTarget(null);
                    }}
                    onProductionSizeChange={(productionSize) =>
                      onRecipeProductionSizeChange(
                        focusedLayout.id,
                        entry.id,
                        productionSize,
                      )
                    }
                    onMachineChange={(machineId) =>
                      onRecipeMachineChange(focusedLayout.id, entry.id, machineId)
                    }
                    onRemove={() => onRemoveRecipeFromLayout(focusedLayout.id, entry.id)}
                    onSelect={() => setSelectedEntryId(entry.id)}
                  />
                );
              })
            ) : (
              <div className="layout-editor__empty">
                <PackageOpen size={34} aria-hidden="true" />
                <div>
                  <h2>No recipes yet</h2>
                  <span>Empty layout</span>
                </div>
                <button
                  className="primary-action-button"
                  type="button"
                  onClick={openImportDialog}
                >
                  <Import size={18} aria-hidden="true" />
                  Import layout
                </button>
              </div>
            )}
          </div>
        </section>

        <LayoutRecipeInspector
          data={data}
          entry={selectedEntry}
          recipe={selectedRecipe}
          onBeaconsChange={(beacons) => {
            if (focusedLayout && selectedEntry) {
              onRecipeBeaconsChange(focusedLayout.id, selectedEntry.id, beacons);
            }
          }}
          onModulesChange={(modules) => {
            if (focusedLayout && selectedEntry) {
              onRecipeModulesChange(focusedLayout.id, selectedEntry.id, modules);
            }
          }}
          onOpenRecipeContext={onSelectItem}
        />
      </div>

      {isImportDialogOpen ? (
        <div
          className="layout-string-backdrop"
          onClick={closeImportDialog}
        >
          <section
            aria-labelledby="layout-import-title"
            aria-modal="true"
            className="layout-string-dialog app-panel"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="layout-string-dialog__header">
              <h2 id="layout-import-title">Import layout string</h2>
              <button
                aria-label="Close import"
                className="icon-button"
                data-tooltip="Close"
                type="button"
                onClick={closeImportDialog}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </header>
            <label className="layout-string-dialog__field">
              <span>Layout JSON</span>
              <textarea
                autoFocus
                spellCheck={false}
                value={importDraft}
                onChange={(event) => {
                  setImportDraft(event.target.value);
                  setImportError(null);
                }}
              />
            </label>
            {importError ? (
              <p className="layout-string-dialog__error">{importError}</p>
            ) : null}
            <div className="layout-string-dialog__actions">
              <button
                className="layout-string-dialog__secondary"
                type="button"
                onClick={closeImportDialog}
              >
                Cancel
              </button>
              <button
                className="primary-action-button"
                type="button"
                onClick={submitImport}
              >
                <Check size={18} aria-hidden="true" />
                Import
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

interface LayoutEditorRecipeRowProps {
  data: RecipeExplorerData;
  dragging: boolean;
  dropPlacement: LayoutReorderPlacement | null;
  entry: RecipeLayoutEntry;
  index: number;
  recipe: RecipePrototype;
  selected: boolean;
  onDragStart(): void;
  onMachineChange(machineId: string): void;
  onProductionSizeChange(productionSize: number): void;
  onRemove(): void;
  onSelect(): void;
}

interface LayoutMachineOption {
  icon: FactorioLabIcon | undefined;
  id: string;
  name: string;
}

function LayoutEditorRecipeRow({
  data,
  dragging,
  dropPlacement,
  entry,
  index,
  onMachineChange,
  onDragStart,
  onProductionSizeChange,
  onRemove,
  onSelect,
  recipe,
  selected,
}: LayoutEditorRecipeRowProps) {
  const metadata = getRecipeMetadata(recipe);
  const machineOptions = getRecipeMachineOptions(data, metadata.producers);
  const selectedMachine =
    machineOptions.find((option) => option.id === entry.machineId) ??
    machineOptions[0] ??
    null;
  const [productionSizeDraft, setProductionSizeDraft] = useState(
    formatProductionSize(entry.productionSize),
  );

  useEffect(() => {
    setProductionSizeDraft(formatProductionSize(entry.productionSize));
  }, [entry.productionSize]);

  return (
    <div
      className={`layout-editor-row ${selected ? "layout-editor-row--selected" : ""} ${
        dragging ? "layout-editor-row--dragging" : ""
      } ${dropPlacement ? `layout-editor-row--drop-${dropPlacement}` : ""}`}
      data-layout-editor-entry={entry.id}
    >
      <button
        aria-label={`Reorder ${metadata.name}`}
        className="layout-editor-row__drag"
        data-tooltip="Drag to reorder"
        type="button"
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          onDragStart();
        }}
      >
        <GripVertical size={14} aria-hidden="true" />
        <span>{index + 1}</span>
      </button>
      <button
        aria-label={`Inspect ${metadata.name}`}
        aria-pressed={selected}
        className="layout-editor-row__main"
        data-tooltip={`${metadata.name} (${metadata.id})`}
        type="button"
        onClick={onSelect}
      >
        <RecipeIcon data={data} recipe={recipe} size={34} />
        <span className="layout-editor-row__identity">
          <strong>{metadata.name}</strong>
          <small>{metadata.id}</small>
        </span>
        <span className="layout-editor-row__meta" aria-hidden="true">
          <span>
            <Timer size={13} aria-hidden="true" />
            {formatTime(recipe.energy_required)}
          </span>
        </span>
      </button>
      <label
        className="layout-editor-row__machine"
        data-tooltip={
          selectedMachine ? `Machine: ${selectedMachine.name}` : "No machine choice"
        }
      >
        <span className="layout-editor-row__machine-icon" aria-hidden="true">
          {selectedMachine ? (
            <IconSprite
              atlas={data.atlas}
              icon={selectedMachine.icon}
              label={selectedMachine.name}
              size={22}
            />
          ) : null}
        </span>
        <select
          aria-label={`${metadata.name} producing machine`}
          disabled={!machineOptions.length}
          value={selectedMachine?.id ?? ""}
          onChange={(event) => onMachineChange(event.target.value)}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {machineOptions.length ? (
            machineOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))
          ) : (
            <option value="">natural</option>
          )}
        </select>
      </label>
      <FactorySettingsSummary data={data} entry={entry} />
      <label className="layout-editor-row__size" data-tooltip="Production size">
        <span aria-hidden="true">×</span>
        <input
          aria-label={`${metadata.name} production size`}
          inputMode="decimal"
          min="0.000001"
          step="any"
          type="number"
          value={productionSizeDraft}
          onBlur={() => {
            if (parseProductionSizeInput(productionSizeDraft) === null) {
              setProductionSizeDraft(formatProductionSize(entry.productionSize));
            }
          }}
          onChange={(event) => {
            const nextDraft = event.target.value;
            const productionSize = parseProductionSizeInput(nextDraft);

            setProductionSizeDraft(nextDraft);

            if (productionSize !== null) {
              onProductionSizeChange(productionSize);
            }
          }}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        />
      </label>
      <button
        aria-label={`Remove ${metadata.name} from layout`}
        className="layout-editor-row__remove"
        data-tooltip="Remove recipe"
        type="button"
        onClick={onRemove}
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

function FactorySettingsSummary({
  data,
  entry,
}: {
  data: RecipeExplorerData;
  entry: RecipeLayoutEntry;
}) {
  const summaryCount = getFactorySettingsSummaryCount(entry.modules, entry.beacons);

  return (
    <div
      className={`layout-editor-row__factory ${
        summaryCount ? "" : "layout-editor-row__factory--empty"
      }`}
      data-tooltip={summaryCount ? "Factory settings" : "No modules or beacons"}
    >
      {entry.modules?.map((module) => (
        <FactorySettingChip
          count={module.count}
          data={data}
          id={module.id}
          key={`module:${module.id}`}
        />
      ))}
      {entry.beacons?.map((beacon, index) => (
        <FactorySettingChip
          count={beacon.count}
          data={data}
          id={beacon.id}
          key={`beacon:${beacon.id}:${index}`}
        />
      ))}
      {summaryCount ? null : <span>empty</span>}
    </div>
  );
}

function FactorySettingChip({
  count,
  data,
  id,
}: {
  count: number;
  data: RecipeExplorerData;
  id: string;
}) {
  const item = data.itemById.get(id);
  const icon = data.iconById.get(item ? getIconIdForItem(item) : id);
  const label = item?.name ?? formatId(id);

  return (
    <span className="factory-setting-chip" title={`${label} x ${formatNumber(count)}`}>
      <IconSprite atlas={data.atlas} icon={icon} label={label} size={20} />
      <em>{formatNumber(count)}</em>
    </span>
  );
}

function getRecipeMachineOptions(
  data: RecipeExplorerData,
  producerIds: string[],
): LayoutMachineOption[] {
  return producerIds.map((producerId) => {
    const item = data.itemById.get(producerId);
    const name = item?.name ?? formatId(producerId);
    const iconId = item ? getIconIdForItem(item) : producerId;

    return {
      icon: data.iconById.get(iconId),
      id: producerId,
      name,
    };
  });
}

interface LayoutRecipeInspectorProps {
  data: RecipeExplorerData;
  entry: RecipeLayoutEntry | null;
  recipe: RecipePrototype | null;
  onBeaconsChange(beacons: LayoutBeaconSettings[]): void;
  onModulesChange(modules: LayoutModuleSettings[]): void;
  onOpenRecipeContext(itemId: string): void;
}

function LayoutRecipeInspector({
  data,
  entry,
  onBeaconsChange,
  onModulesChange,
  onOpenRecipeContext,
  recipe,
}: LayoutRecipeInspectorProps) {
  if (!entry || !recipe) {
    return (
      <aside className="layout-inspector app-panel" aria-label="Recipe inspector">
        <div className="layout-inspector__empty">
          <PackageOpen size={34} aria-hidden="true" />
          <div>
            <h2>No recipe selected</h2>
            <span>Select a recipe instance</span>
          </div>
        </div>
      </aside>
    );
  }

  const metadata = getRecipeMetadata(recipe);
  const contextItemId = getRecipeContextItemId(data, recipe);
  const selectedMachineId = getRecipeSelectedMachineId(recipe, entry.machineId);
  const machineModuleOptions = getRecipeModuleOptions(data, recipe, selectedMachineId);
  const machineModuleCapacity = getMachineModuleCapacity(data, selectedMachineId);
  const canUseFactorySettings = machineModuleOptions.length > 0 && Boolean(machineModuleCapacity);
  const tags = [
    ...metadata.flags,
    ...metadata.disallowedEffects.map((effect) => `no ${effect}`),
  ];

  return (
    <aside className="layout-inspector app-panel" aria-label="Recipe inspector">
      <header className="layout-inspector__header">
        <RecipeIcon data={data} recipe={recipe} size={42} />
        <div>
          <h2>{metadata.name}</h2>
          <span>{metadata.id}</span>
        </div>
      </header>

      <RecipeMetaPills
        classNames={{
          icon: "layout-inspector__icon-pill",
          producer: "layout-inspector__icon-pill--producer",
          root: "layout-inspector__stats",
          surface: "layout-inspector__icon-pill--surface",
          text: "layout-inspector__text-pill",
          time: "layout-inspector__text-pill",
        }}
        data={data}
        energyRequired={recipe.energy_required}
        iconSize={24}
        includeAllSurfaces
        leading={
          <span className="layout-inspector__text-pill" title="Production size">
            × {formatProductionSize(entry.productionSize)}
          </span>
        }
        metadata={metadata}
        producerIds={selectedMachineId ? [selectedMachineId] : []}
      />

      <div className="layout-inspector__equation">
        <InspectorMaterialGroup
          data={data}
          entries={recipe.ingredients ?? []}
          label="Ingredients"
        />
        <ArrowRight size={18} aria-hidden="true" />
        <InspectorMaterialGroup
          data={data}
          entries={recipe.results ?? []}
          label="Results"
        />
      </div>

      {tags.length ? (
        <div className="layout-inspector__tags">
          {tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}

      <section className="layout-inspector__factory">
        <header className="layout-inspector__section-heading">
          <h3>Modules</h3>
          {machineModuleCapacity && machineModuleCapacity !== true ? (
            <span>
              {formatNumber(sumModuleCounts(entry.modules))}/
              {formatNumber(machineModuleCapacity)}
            </span>
          ) : null}
        </header>
        {canUseFactorySettings ? (
          <ModuleSettingsRows
            addLabel="Add module"
            capacity={machineModuleCapacity}
            data={data}
            emptyLabel="No modules selected"
            options={machineModuleOptions}
            value={entry.modules ?? []}
            onChange={onModulesChange}
          />
        ) : (
          <p className="layout-inspector__muted">Selected machine has no module slots.</p>
        )}
      </section>

      <section className="layout-inspector__factory">
        <header className="layout-inspector__section-heading">
          <h3>Beacons</h3>
        </header>
        {canUseFactorySettings ? (
          <BeaconSettingsRows
            data={data}
            value={entry.beacons ?? []}
            onChange={onBeaconsChange}
          />
        ) : (
          <p className="layout-inspector__muted">Beacons need a module-capable machine.</p>
        )}
      </section>

      <button
        className="layout-inspector__open primary-action-button"
        disabled={!contextItemId}
        type="button"
        onClick={() => {
          if (contextItemId) {
            onOpenRecipeContext(contextItemId);
          }
        }}
      >
        <ExternalLink size={17} aria-hidden="true" />
        Open in Recipes
      </button>
    </aside>
  );
}

interface ModuleSettingsRowsProps {
  addLabel: string;
  capacity: number | true | null;
  data: RecipeExplorerData;
  emptyLabel: string;
  getDefaultSetting?(): LayoutModuleSettings | null;
  options: LayoutFactoryItemOption[];
  value: LayoutModuleSettings[];
  onChange(value: LayoutModuleSettings[]): void;
}

function ModuleSettingsRows({
  addLabel,
  capacity,
  data,
  emptyLabel,
  getDefaultSetting,
  options,
  value,
  onChange,
}: ModuleSettingsRowsProps) {
  const usedSlots = sumModuleCounts(value);
  const finiteCapacity = capacity === true ? null : capacity;
  const remainingSlots =
    finiteCapacity === null ? Number.POSITIVE_INFINITY : Math.max(0, finiteCapacity - usedSlots);
  const canAdd = options.length > 0 && remainingSlots > 0;

  function commit(nextValue: LayoutModuleSettings[]) {
    onChange(sanitizeModuleSettings(nextValue, options, capacity));
  }

  function addModule() {
    if (!canAdd) {
      return;
    }

    const defaults = getDefaultSetting
      ? [getDefaultSetting()].filter(
          (setting): setting is LayoutModuleSettings => setting !== null,
        )
      : getDefaultMachineModuleSettings(options, capacity);
    const fallbackId = options[0]?.id;
    const nextSetting = defaults[0] ?? (fallbackId ? { id: fallbackId, count: 1 } : null);

    if (!nextSetting) {
      return;
    }

    commit([...value, { ...nextSetting, count: Math.min(nextSetting.count, remainingSlots) }]);
  }

  return (
    <div className="factory-settings-editor">
      {value.length ? (
        value.map((setting, index) => (
          <FactoryModuleSettingRow
            data={data}
            key={`${setting.id}:${index}`}
            options={options}
            setting={setting}
            onCountChange={(count) =>
              commit(value.map((item, itemIndex) =>
                itemIndex === index ? { ...item, count } : item,
              ))
            }
            onIdChange={(id) =>
              commit(value.map((item, itemIndex) =>
                itemIndex === index ? { ...item, id } : item,
              ))
            }
            onRemove={() => commit(value.filter((_, itemIndex) => itemIndex !== index))}
          />
        ))
      ) : (
        <p className="layout-inspector__muted">{emptyLabel}</p>
      )}
      <button
        className="factory-settings-editor__add"
        disabled={!canAdd}
        type="button"
        onClick={addModule}
      >
        <Plus size={15} aria-hidden="true" />
        {addLabel}
      </button>
    </div>
  );
}

interface FactoryModuleSettingRowProps {
  data: RecipeExplorerData;
  options: LayoutFactoryItemOption[];
  setting: LayoutModuleSettings;
  onCountChange(count: number): void;
  onIdChange(id: string): void;
  onRemove(): void;
}

function FactoryModuleSettingRow({
  data,
  onCountChange,
  onIdChange,
  onRemove,
  options,
  setting,
}: FactoryModuleSettingRowProps) {
  const item = data.itemById.get(setting.id);
  const icon = data.iconById.get(item ? getIconIdForItem(item) : setting.id);
  const label = item?.name ?? formatId(setting.id);

  return (
    <div className="factory-settings-row">
      <span className="factory-settings-row__icon" aria-hidden="true">
        <IconSprite atlas={data.atlas} icon={icon} label={label} size={24} />
      </span>
      <input
        aria-label={`${label} count`}
        inputMode="decimal"
        min="0"
        step="1"
        type="number"
        value={formatProductionSize(setting.count)}
        onChange={(event) => onCountChange(Number(event.target.value))}
      />
      <select
        aria-label="Module"
        value={setting.id}
        onChange={(event) => onIdChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      <button
        aria-label={`Remove ${label}`}
        className="factory-settings-row__remove"
        data-tooltip="Remove"
        type="button"
        onClick={onRemove}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

interface BeaconSettingsRowsProps {
  data: RecipeExplorerData;
  value: LayoutBeaconSettings[];
  onChange(value: LayoutBeaconSettings[]): void;
}

function BeaconSettingsRows({ data, onChange, value }: BeaconSettingsRowsProps) {
  const beaconOptions = getBeaconOptions(data);

  function commit(nextValue: LayoutBeaconSettings[]) {
    onChange(sanitizeBeaconSettings(data, nextValue));
  }

  function addBeacon() {
    const defaults = getDefaultBeaconSettings(data);
    const fallbackBeacon = beaconOptions[0];

    if (defaults[0]) {
      commit([...value, defaults[0]]);
    } else if (fallbackBeacon) {
      commit([...value, { id: fallbackBeacon.id, count: 1, modules: [] }]);
    }
  }

  return (
    <div className="factory-settings-editor">
      {value.length ? (
        value.map((beacon, index) => {
          const moduleOptions = getBeaconModuleOptions(data, beacon.id);
          const moduleCapacity = getBeaconModuleCapacity(data, beacon.id);
          const item = data.itemById.get(beacon.id);
          const icon = data.iconById.get(item ? getIconIdForItem(item) : beacon.id);
          const label = item?.name ?? formatId(beacon.id);

          return (
            <div className="beacon-settings-card" key={`${beacon.id}:${index}`}>
              <div className="factory-settings-row">
                <span className="factory-settings-row__icon" aria-hidden="true">
                  <IconSprite atlas={data.atlas} icon={icon} label={label} size={24} />
                </span>
                <input
                  aria-label={`${label} count`}
                  inputMode="decimal"
                  min="0"
                  step="1"
                  type="number"
                  value={formatProductionSize(beacon.count)}
                  onChange={(event) =>
                    commit(value.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, count: Number(event.target.value) }
                        : item,
                    ))
                  }
                />
                <select
                  aria-label="Beacon"
                  value={beacon.id}
                  onChange={(event) => {
                    const nextBeaconId = event.target.value;
                    const nextModules = sanitizeModuleSettings(
                      beacon.modules,
                      getBeaconModuleOptions(data, nextBeaconId),
                      getBeaconModuleCapacity(data, nextBeaconId),
                    );

                    commit(value.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, id: nextBeaconId, modules: nextModules }
                        : item,
                    ));
                  }}
                >
                  {beaconOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
                <button
                  aria-label={`Remove ${label}`}
                  className="factory-settings-row__remove"
                  data-tooltip="Remove"
                  type="button"
                  onClick={() => commit(value.filter((_, itemIndex) => itemIndex !== index))}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
              <ModuleSettingsRows
                addLabel="Add beacon module"
                capacity={moduleCapacity}
                data={data}
                emptyLabel="No beacon modules selected"
                getDefaultSetting={() =>
                  getDefaultBeaconModuleSettings(data, beacon.id)[0] ?? null
                }
                options={moduleOptions}
                value={beacon.modules}
                onChange={(modules) =>
                  commit(value.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, modules } : item,
                  ))
                }
              />
            </div>
          );
        })
      ) : (
        <p className="layout-inspector__muted">No beacons selected</p>
      )}
      <button
        className="factory-settings-editor__add"
        disabled={!beaconOptions.length}
        type="button"
        onClick={addBeacon}
      >
        <Plus size={15} aria-hidden="true" />
        Add beacon
      </button>
    </div>
  );
}

function sumModuleCounts(modules: readonly LayoutModuleSettings[] | undefined): number {
  return modules?.reduce((sum, module) => sum + module.count, 0) ?? 0;
}

interface InspectorMaterialGroupProps {
  data: RecipeExplorerData;
  entries: readonly (IngredientPrototype | ProductPrototype)[];
  label: string;
}

function InspectorMaterialGroup({
  data,
  entries,
  label,
}: InspectorMaterialGroupProps) {
  return (
    <section className="layout-inspector__section">
      <h3>{label}</h3>
      {entries.length ? (
        <ul className="layout-inspector__materials">
          {entries.map((entry, index) => (
            <InspectorMaterial
              data={data}
              entry={entry}
              key={`${materialKey(entry)}:${index}`}
            />
          ))}
        </ul>
      ) : (
        <span className="layout-inspector__none">none</span>
      )}
    </section>
  );
}

interface InspectorMaterialProps {
  data: RecipeExplorerData;
  entry: IngredientPrototype | ProductPrototype;
}

function InspectorMaterial({ data, entry }: InspectorMaterialProps) {
  const item = data.itemById.get(entry.name);
  const icon = data.iconById.get(item ? getIconIdForItem(item) : entry.name);
  const label = item?.name ?? formatId(entry.name);

  return (
    <li className="layout-inspector__material">
      <IconSprite atlas={data.atlas} icon={icon} label={label} size={24} />
      <span>
        <strong>{label}</strong>
        <small>{entry.name}</small>
      </span>
      <em>{formatMaterialAmount(entry)}</em>
    </li>
  );
}

function formatProductionSize(value: number): string {
  return Number.isFinite(value) ? String(value) : "1";
}

function parseProductionSizeInput(value: string): number | null {
  const productionSize = Number(value);

  return Number.isFinite(productionSize) && productionSize > 0
    ? productionSize
    : null;
}

function getRecipeContextItemId(
  data: RecipeExplorerData,
  recipe: RecipePrototype,
): string | null {
  const resultItem = recipe.results?.find((entry) => data.itemById.has(entry.name));

  if (resultItem) {
    return resultItem.name;
  }

  return recipe.ingredients?.find((entry) => data.itemById.has(entry.name))?.name ?? null;
}

function formatMaterialAmount(entry: IngredientPrototype | ProductPrototype): string {
  const amount = "amount" in entry ? entry.amount : undefined;
  const amountMin = "amount_min" in entry ? entry.amount_min : undefined;
  const amountMax = "amount_max" in entry ? entry.amount_max : undefined;
  const amountText =
    amount !== undefined
      ? formatNumber(amount)
      : amountMin !== undefined && amountMax !== undefined
        ? `${formatNumber(amountMin)}-${formatNumber(amountMax)}`
        : "var";
  const probability =
    "probability" in entry && typeof entry.probability === "number" && entry.probability < 1
      ? `, ${formatNumber(entry.probability * 100)}%`
      : "";
  const temperature =
    entry.type === "fluid" &&
    "temperature" in entry &&
    typeof entry.temperature === "number"
      ? `, ${formatNumber(entry.temperature)}C`
      : "";

  return `${amountText}${probability}${temperature}`;
}

function materialKey(entry: IngredientPrototype | ProductPrototype): string {
  return `${entry.type}:${entry.name}:${formatMaterialAmount(entry)}`;
}

function formatTime(value: number | undefined): string {
  if (value === undefined) {
    return "time n/a";
  }

  return `${formatNumber(value)}s`;
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) {
    return `${value}`;
  }

  return `${Number(value.toFixed(3))}`;
}

function formatId(id: string): string {
  return id.replaceAll("-", " ");
}
