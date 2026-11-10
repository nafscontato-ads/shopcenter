/**
 * "Product details" copied by the admin from the supplier's own Shopee page
 * (category breadcrumb, labelled specifications and description). They are
 * real facts about the product, so they fill the category and the matching
 * Shopee characteristics for every customer who publishes it.
 */
import { normalizedText, readAttributeDefinitions, record, type AttributeDefinition, type ShopeeAttribute } from "@/lib/shopee-publishing";
import type { ShopeeCategoryOption } from "@/lib/shopee-product-defaults";

export type ShopeeReferenceField = { label: string; value: string };
export type ShopeeReference = { categoryPath: string[]; fields: ShopeeReferenceField[]; description: string; savedAt?: string };

const SEPARATOR = /^(?:icon\s*arrow\s*right|[›>»/|]|→)$/i;
const INLINE_SEPARATOR = /\s*(?:icon\s*arrow\s*right|›|»|>|→)\s*/i;
const DESCRIPTION_HEADER = /^descri[çc][ãa]o\s+do\s+produto\b/i;
/** Labels that describe the seller's stock/shipping or are sent elsewhere (brand), never as characteristics. */
const IGNORED_LABELS = new Set(["estoque", "envio de", "condicao", "marca", "categoria", "especificacoes do produto", "especificacoes", "detalhes do produto"]);

const clean = (value: string) => value.replace(/\s+/g, " ").trim();

/** Read the text copied from a Shopee product page. Returns null when nothing usable was found. */
export function parseShopeeProductDetails(raw: string): ShopeeReference | null {
  const text = raw.replace(/\r\n?/g, "\n");
  const descriptionMatch = text.match(/^[ \t]*descri[çc][ãa]o\s+do\s+produto[ \t]*:?[ \t]*$/im);
  const head = descriptionMatch?.index == null ? text : text.slice(0, descriptionMatch.index);
  const description = descriptionMatch?.index == null ? "" : text.slice(descriptionMatch.index + descriptionMatch[0].length).replace(/^\n+/, "").trimEnd();
  const lines = head.split("\n").map(clean).filter(Boolean);

  let index = lines.findIndex((line) => /^categoria\b/i.test(line));
  const categoryPath: string[] = [];
  if (index >= 0) {
    const inline = lines[index]?.replace(/^categoria\s*[:\t]?\s*/i, "") ?? "";
    index += 1;
    if (inline) categoryPath.push(...inline.split(INLINE_SEPARATOR).map(clean).filter(Boolean));
    else {
      const first = lines[index];
      if (first && !SEPARATOR.test(first)) {
        categoryPath.push(...first.split(INLINE_SEPARATOR).map(clean).filter(Boolean));
        index += 1;
        while (lines[index] && SEPARATOR.test(lines[index] ?? "") && lines[index + 1]) {
          categoryPath.push(lines[index + 1] ?? "");
          index += 2;
        }
      }
    }
  } else index = 0;
  while (categoryPath.length && normalizedText(categoryPath[0] ?? "") === "shopee") categoryPath.shift();

  const fields: ShopeeReferenceField[] = [];
  const add = (label: string, value: string) => {
    const name = clean(label).replace(/:$/, "");
    const content = clean(value).slice(0, 200);
    if (!name || !content || name.length > 80 || IGNORED_LABELS.has(normalizedText(name))) return;
    if (!fields.some((field) => normalizedText(field.label) === normalizedText(name))) fields.push({ label: name, value: content });
  };
  for (let cursor = index; cursor < lines.length && fields.length < 40; cursor += 1) {
    const line = lines[cursor] ?? "";
    if (DESCRIPTION_HEADER.test(line)) break;
    const tab = head.split("\n").find((rawLine) => clean(rawLine) === line && rawLine.includes("\t"));
    if (tab) {
      const [label, ...rest] = tab.split("\t");
      add(label ?? "", rest.join(" "));
      continue;
    }
    const value = lines[cursor + 1];
    if (value == null) break;
    add(line, value);
    cursor += 1;
  }
  if (!categoryPath.length && !fields.length && !description) return null;
  return { categoryPath: categoryPath.slice(0, 8), fields, description: description.slice(0, 5000) };
}

/** Stored JSON back into a reference; anything malformed is ignored. */
export function readShopeeReference(value: unknown): ShopeeReference | null {
  const row = record(value);
  const categoryPath = Array.isArray(row["categoryPath"]) ? row["categoryPath"].map(String).filter(Boolean) : [];
  const fields = Array.isArray(row["fields"]) ? row["fields"].flatMap((item) => {
    const field = record(item);
    return typeof field["label"] === "string" && typeof field["value"] === "string" ? [{ label: field["label"], value: field["value"] }] : [];
  }) : [];
  const description = typeof row["description"] === "string" ? row["description"] : "";
  if (!categoryPath.length && !fields.length && !description) return null;
  return { categoryPath, fields, description, ...(typeof row["savedAt"] === "string" ? { savedAt: row["savedAt"] } : {}) };
}

/** "Label: value" lines, so regulatory extraction also sees the pasted codes. */
export function referenceFactsText(reference: ShopeeReference | null) {
  return reference ? reference.fields.map((field) => `${field.label}: ${field.value}`).join("\n") : "";
}

function fieldFor(definition: AttributeDefinition, fields: ShopeeReferenceField[]) {
  const name = normalizedText(definition.name);
  return fields.find((field) => normalizedText(field.label) === name)
    ?? fields.find((field) => {
      const label = normalizedText(field.label);
      return label.length >= 6 && name.length >= 6 && (label.includes(name) || name.includes(label));
    });
}

function valueFor(definition: AttributeDefinition, raw: string): ShopeeAttribute | null {
  const value = clean(raw);
  if (definition.units.length) {
    const match = value.match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-Zµ%°²³]+)?$/);
    if (!match?.[1]) return null;
    const unit = match[2] ? definition.units.find((item) => item.toLowerCase() === match[2]?.toLowerCase()) : definition.units.length === 1 ? definition.units[0] : undefined;
    if (!unit) return null;
    return { attribute_id: definition.id, attribute_value_list: [{ value_id: 0, original_value_name: match[1].replace(",", "."), value_unit: unit }] };
  }
  const options = definition.values.filter((item) => item.id > 0);
  const pick = (part: string) => {
    const wanted = normalizedText(part);
    return options.find((item) => normalizedText(item.name) === wanted || normalizedText(item.originalName) === wanted);
  };
  const parts = definition.multiple ? value.split(/\s*[,;]\s*/).filter(Boolean) : [value];
  const selected = parts.map(pick).filter((item): item is NonNullable<typeof item> => Boolean(item));
  if (selected.length) {
    const unique = [...new Map(selected.map((item) => [item.id, item])).values()].slice(0, definition.multiple ? 50 : 1);
    return { attribute_id: definition.id, attribute_value_list: unique.map((item) => ({ value_id: item.id, original_value_name: item.originalName })) };
  }
  // Closed lists only accept official options; free-text fields keep the supplier's exact wording.
  if (/^(DROP_DOWN|MULTIPLE_SELECT)$/i.test(definition.inputType)) return null;
  return { attribute_id: definition.id, attribute_value_list: [{ value_id: 0, original_value_name: value.slice(0, 200) }] };
}

/** Characteristics of the category that the pasted details answer, valid for Shopee as sent. */
export function referenceAttributes(response: unknown, reference: ShopeeReference | null): ShopeeAttribute[] {
  if (!reference?.fields.length) return [];
  let selected: ShopeeAttribute[] = [];
  for (let pass = 0; pass < 5; pass += 1) {
    const next = [...selected];
    for (const definition of readAttributeDefinitions(response, selected)) {
      if (next.some((item) => item.attribute_id === definition.id)) continue;
      const field = fieldFor(definition, reference.fields);
      const attribute = field ? valueFor(definition, field.value) : null;
      if (attribute) next.push(attribute);
    }
    if (next.length === selected.length) break;
    selected = next;
  }
  return selected;
}

/** The pasted facts win over earlier automatic or default values for the same characteristic. */
export function mergeReferenceAttributes(existing: ShopeeAttribute[], reference: ShopeeAttribute[]) {
  return [...existing.filter((item) => !reference.some((entry) => entry.attribute_id === item.attribute_id)), ...reference];
}

/** Leaf categories inside the supplier's breadcrumb (the page often stops one level above the leaf). */
export function referenceCategoryCandidates(path: string[], leaves: ShopeeCategoryOption[]) {
  const wanted = path.map(normalizedText).filter(Boolean);
  if (!wanted.length) return [];
  const segmentsOf = (option: ShopeeCategoryOption) => (option.category_path ?? option.display_category_name ?? option.original_category_name ?? "").split(" › ").map(normalizedText);
  for (let skip = 0; skip < wanted.length; skip += 1) {
    const tail = wanted.slice(skip);
    const found = leaves.filter((option) => {
      const segments = segmentsOf(option);
      for (let start = 0; start + tail.length <= segments.length; start += 1) {
        if (tail.every((segment, offset) => segments[start + offset] === segment)) return skip === 0 ? start === 0 : true;
      }
      return false;
    });
    if (found.length) return found;
    if (tail.length <= 1) break;
  }
  return [];
}
