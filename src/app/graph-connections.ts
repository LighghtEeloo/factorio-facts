import {
  entitiesCanFlow,
  type IngredientPrototype,
  type ProductPrototype,
} from "../factorio/prototypes";

export interface GraphConnectionNode {
  id: string;
  ingredients: IngredientPrototype[];
  label: string;
  results: ProductPrototype[];
}

export interface GraphConnectionCandidate {
  availableItems: ProductPrototype[];
  id: string;
  sourceId: string;
  sourceName: string;
  targetId: string;
  targetName: string;
}

export function getCompatibleGraphConnections(
  sourceNodes: readonly GraphConnectionNode[],
  targetNodes: readonly GraphConnectionNode[] = sourceNodes,
): GraphConnectionCandidate[] {
  const connections: GraphConnectionCandidate[] = [];

  for (const source of sourceNodes) {
    for (const target of targetNodes) {
      if (target.id === source.id) {
        continue;
      }

      const availableItems = uniqueProducts(
        source.results.filter((result) =>
          target.ingredients.some((ingredient) => entitiesCanFlow(result, ingredient)),
        ),
      );

      if (!availableItems.length) {
        continue;
      }

      connections.push({
        availableItems,
        id: getGraphEdgeId(source.id, target.id),
        sourceId: source.id,
        sourceName: source.label,
        targetId: target.id,
        targetName: target.label,
      });
    }
  }

  return connections.sort((left, right) => left.id.localeCompare(right.id));
}

export function getGraphEdgeId(sourceId: string, targetId: string): string {
  return `${sourceId}->${targetId}`;
}

function uniqueProducts(entries: ProductPrototype[]): ProductPrototype[] {
  const seen = new Set<string>();

  return entries.filter((entry) => {
    const key = `${entry.type}:${entry.name}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
