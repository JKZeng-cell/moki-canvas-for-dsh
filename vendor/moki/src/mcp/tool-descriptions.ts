// English discovery metadata complements the existing Chinese descriptions.
export const MCP_TOOL_DESCRIPTIONS_EN: Record<string, string> = {
  whiteboard_list: 'List local whiteboards. Start here to choose an explicit boardId before inspecting or editing.',
  whiteboard_create: 'Create a local whiteboard with one empty page. Returns the new board ID and version.',
  whiteboard_inspect: 'Inspect pages, element IDs, text, bounds, styles, version, and agent context. Read before and after editing. The default board is the most recently updated, not necessarily the board open in the UI.',
  whiteboard_rename: 'Rename an explicit board. Supply expectedVersion from inspect for conflict protection.',
  whiteboard_duplicate: 'Duplicate all pages and content of a board, preserving image and file references.',
  whiteboard_delete_board: 'Permanently delete an explicit board; requires confirm=true. Prefer expectedVersion. Does not delete original mapped files.',
  whiteboard_get_thumbnail: 'Read the last saved board screenshot and its version. A thumbnail may be unavailable until the board has been opened and saved in the UI.',
  whiteboard_create_page: 'Create a page in an explicit board and make it the current page.',
  whiteboard_manage_pages: 'List, rename, reorder, group, or delete pages. Deleting a page also deletes its content; at least one page must remain.',
  whiteboard_manage_page_groups: 'List, create, rename, or delete page groups. Deleting a group preserves its pages as ungrouped.',
  whiteboard_add_elements: 'Add elements in batches. For editable native mind maps use kind: mindmap, text: topic, layout: both/right/left/down, width: default node width (64–4096), branches: strings or {title, children: string[], width?, color?}. Creates up to 200 branches/leaves per map, preserving hierarchy, two-sided layout and full text. Returns compact node IDs/parents/text/sizes; use branches: [] for an empty root. Positions use canvas world coordinates.',
  whiteboard_update_elements: 'Update text, position, size, color, or rotation by exact element IDs. Mind-map width changes wrap text, fit height, and reflow the native tree without scaling text. Supports a batch of node widths in one call.',
  whiteboard_align_elements: 'Align or evenly distribute two or more elements using their exact IDs.',
  whiteboard_delete_elements: 'Delete only the explicitly listed element IDs, not pages or entire boards.',
  whiteboard_export: 'Export a snapshot and .moki download URL (requires the HTTP API). With includeArchive=true, return a self-contained Base64 ZIP with images/files, up to 8 MiB; use app or HTTP export for larger boards.',
  whiteboard_native_edit: 'Use the native canvas editor for properties, grouping, virtual folders, and mind-map branches. mindmap_child / mindmap_sibling accept text and width. Prefer action: mindmap_children, ids: [parentNodeId], nodes: [{key: "a", text: "Branch", width: 320}, {parentId: "a", text: "Leaf"}] to add up to 200 nodes in ONE atomic call. parentId may reference an existing node in the same map or any key in the batch. Returns IDs/key mapping and new nodes only; includeSnapshot: true adds full page details. Existing trees support mindmap_toggle, mindmap_reparent and mindmap_promote. Rotation is in degrees.',
};
