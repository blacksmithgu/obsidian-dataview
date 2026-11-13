/** French display strings. Keys are the unchanged English fallback messages. */
export const french: Record<string, string> = {
    Yes: "Oui",
    No: "Non",
    "<Empty List>": "<Liste vide>",
    "<Empty Object>": "<Objet vide>",
    "Force refresh all views and blocks": "Actualiser toutes les vues et tous les blocs",
    "Drop all cached file metadata": "Reconstruire le cache des métadonnées",
    "Rebuild current view": "Reconstruire la vue actuelle",
    "Enable inline queries": "Activer les requêtes en ligne",
    "Enable or disable executing regular inline Dataview queries.":
        "Autorise l’exécution des requêtes Dataview directement dans le texte.",
    "Enable JavaScript queries": "Activer les requêtes JavaScript",
    "Enable or disable executing DataviewJS queries.": "Autorise l’exécution des requêtes DataviewJS.",
    "Enable inline JavaScript queries": "Activer les requêtes JavaScript en ligne",
    "Enable or disable executing inline DataviewJS queries. Requires that DataviewJS queries are enabled.":
        "Autorise les requêtes DataviewJS dans le texte. Les requêtes JavaScript doivent également être activées.",
    "Enable inline field highlighting in reading view": "Mettre en forme les champs en mode lecture",
    "Enables or disables visual highlighting / pretty rendering for inline fields in reading view.":
        "Met en évidence les champs intégrés au texte en mode lecture.",
    "Enable inline field highlighting in Live Preview": "Mettre en forme les champs en aperçu en direct",
    "Enables or disables visual highlighting / pretty rendering for inline fields in Live Preview.":
        "Met en évidence les champs intégrés au texte en aperçu en direct.",
    Codeblocks: "Blocs de code",
    "DataviewJS keyword": "Mot-clé DataviewJS",
    "Keyword for DataviewJS blocks. Defaults to 'dataviewjs'. Reload required for changes to take effect.":
        "Mot-clé des blocs DataviewJS : « dataviewjs » par défaut. Rechargez Dataview après modification.",
    "Inline query prefix": "Préfixe des requêtes en ligne",
    "The prefix to inline queries (to mark them as Dataview queries). Defaults to '='.":
        "Préfixe identifiant les requêtes Dataview dans le texte : « = » par défaut.",
    "JavaScript inline query prefix": "Préfixe des requêtes JavaScript en ligne",
    "The prefix to JavaScript inline queries (to mark them as DataviewJS queries). Defaults to '$='.":
        "Préfixe identifiant les requêtes DataviewJS dans le texte : « $= » par défaut.",
    "Code block inline queries": "Évaluer les requêtes en ligne dans les blocs de code",
    "If enabled, inline queries will also be evaluated inside full code blocks.":
        "Évalue également les requêtes en ligne présentes dans les blocs de code.",
    View: "Affichage",
    "Display result count": "Afficher le nombre de résultats",
    "If toggled off, the small number in the result header of TASK and TABLE queries will be hidden.":
        "Affiche le nombre de résultats dans les en-têtes des requêtes TASK et TABLE.",
    "Warn on empty result": "Signaler les résultats vides",
    "If set, queries which return 0 results will render a warning message.":
        "Affiche un message lorsqu’une requête ne renvoie aucun résultat.",
    "Render null as": "Afficher les valeurs absentes sous la forme",
    "What null/non-existent should show up as in tables, by default. This supports Markdown notation.":
        "Texte affiché pour une valeur absente (null) dans les tableaux. La syntaxe Markdown est acceptée.",
    "Automatic view refreshing": "Actualisation automatique des vues",
    "If enabled, views will automatically refresh when files in your vault change; this can negatively affect":
        "Actualise les vues lorsque les fichiers du coffre changent ; cela peut perturber",
    " some functionality like embeds in views, so turn it off if such functionality is not working.":
        " certaines fonctions, comme les intégrations. Désactivez cette option en cas de problème.",
    "Refresh interval": "Délai d’actualisation",
    "How long to wait (in milliseconds) for files to stop changing before updating views.":
        "Délai d’attente en millisecondes après la dernière modification, avant d’actualiser les vues.",
    "Date format": "Format des dates",
    "The default date format (see Luxon date format options).": "Format des dates par défaut (syntaxe Luxon).",
    " Currently: ": " Exemple : ",
    "Date + time format": "Format des dates et heures",
    "The default date and time format (see Luxon date format options).":
        "Format des dates et heures par défaut (syntaxe Luxon).",
    Tables: "Tableaux",
    "Primary column name": "Nom de la colonne principale",
    "The name of the default ID column in tables; this is the auto-generated first column that links to the source file.":
        "Nom de la première colonne créée automatiquement dans les tableaux, contenant les liens vers les fichiers sources.",
    File: "Fichier",
    "Grouped column name": "Nom de la colonne des groupes",
    "The name of the default ID column in tables, when the table is on grouped data; this is the auto-generated first column":
        "Nom de la première colonne créée automatiquement pour les données regroupées, ",
    "that links to the source file/group.": "contenant les liens vers les fichiers ou les groupes.",
    Group: "Groupe",
    Tasks: "Tâches",
    "Automatic task completion tracking": "Suivre automatiquement la date de fin des tâches",
    "If enabled, Dataview will automatically append tasks with their completion date when they are checked in Dataview views.":
        "Ajoute automatiquement la date de fin aux tâches cochées dans les vues Dataview.",
    "Example with default field name and date format: - [x] my task [completion:: 2022-01-01]":
        "Exemple avec les réglages par défaut : - [x] ma tâche [completion:: 2022-01-01]",
    "Use emoji shorthand for completion": "Utiliser un émoji pour la date de fin",
    'If enabled, will use emoji shorthand instead of inline field formatting to fill out implicit task field "completion".':
        "Utilise un émoji à la place d’un champ en ligne pour indiquer la date de fin de la tâche.",
    "Example: - [x] my task ✅ 2022-01-01": "Exemple : - [x] ma tâche ✅ 2022-01-01",
    "Disable this to customize the completion date format or field name, or to use Dataview inline field formatting.":
        "Désactivez cette option pour personnaliser le nom du champ ou le format de date, ou utiliser un champ Dataview en ligne.",
    'Only available when "automatic task completion tracking" is enabled.':
        "Disponible lorsque le suivi automatique de la date de fin des tâches est activé.",
    "Completion field name": "Nom du champ de date de fin",
    "Text used as inline field key for task completion date when toggling a task's checkbox in a Dataview view.":
        "Nom du champ en ligne recevant la date de fin lorsqu’une tâche est cochée dans Dataview.",
    'Only available when "automatic task completion tracking" is enabled and "use emoji shorthand for completion" is disabled.':
        "Disponible lorsque le suivi automatique est activé et que l’utilisation d’un émoji pour la date de fin est désactivée.",
    "Completion date format": "Format de la date de fin",
    "Date-time format for task completion date when toggling a task's checkbox in a Dataview view (see Luxon date format options).":
        "Format de la date de fin ajoutée lorsqu’une tâche est cochée dans Dataview (syntaxe Luxon).",
    "Currently: ": "Exemple : ",
    "Recursive sub-task completion": "Terminer aussi les sous-tâches",
    "If enabled, completing a task in a Dataview will automatically complete its subtasks too.":
        "Cocher une tâche dans Dataview termine également toutes ses sous-tâches.",
    "<empty list>": "<liste vide>",
    "<empty object>": "<objet vide>",
    "Unrecognized: ": "Valeur non reconnue : ",
    "Dataview: Query returned 0 results.": "Dataview : la requête ne renvoie aucun résultat.",
    "Dataview JS queries are disabled. You can enable them in the Dataview settings.":
        "Les requêtes JavaScript sont désactivées. Vous pouvez les activer dans les réglages de Dataview.",
    "Evaluation Error: ": "Erreur d’évaluation : ",
    "(disabled; enable in settings)": "(désactivé ; à activer dans les réglages)",
    "Dataview: No results to show for list query.": "Dataview : aucun résultat à afficher dans cette liste.",
    "Dataview: No results to show for table query.": "Dataview : aucun résultat à afficher dans ce tableau.",
    "Dataview: No results to show for task query.": "Dataview : aucune tâche à afficher.",
};
