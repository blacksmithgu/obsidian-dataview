/** A schema for some data object; used for validation and to provide richer query support. */
interface Schema {
    /** The name of this schema. */
    name: string;
    /** The list of fields that this schema supports. Maps name to information. */
    fields: { [key: string]: SchemaField }
}

/** A field in a schema. */
interface SchemaField {
    /** Rendered name for this schema field. Inferred from the YAML name if not specified. */
    name: string;
    /** The YAML name of this schema field. */
    yamlName: string;
    /** The type of this field, which determines how it is parsed. */
    type: SchemaFieldType;
}

/** The type of this schema field. */
type SchemaType = 'string' | 'number' | 'duration' | 'date' | 'rating';

/** The type of the schema field. This is inherited for schema types that require more info. */
interface SchemaFieldType {
    type: SchemaType;
}

interface RatingFieldType extends SchemaFieldType {
    type: 'rating';
    /** The maximum rating possible. */
    max: number;
    /** The type of icon used for rendering ratings. */
    icon: 'star' | 'bar' | 'numeric';
}