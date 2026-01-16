/**
 * File Tabs Component
 *
 * Tab bar for managing multiple open files on desktop.
 */

import { useEditorStore } from '../../store';
import type { OpenFile } from '../../store';
import './FileTabs.css';

export function FileTabs() {
  const files = useEditorStore((state) => state.files);
  const activeFileId = useEditorStore((state) => state.activeFileId);
  const setActiveFile = useEditorStore((state) => state.setActiveFile);
  const closeFile = useEditorStore((state) => state.closeFile);
  const newFile = useEditorStore((state) => state.newFile);

  const filesArray = Array.from(files.values());

  const handleClose = (e: React.MouseEvent, fileId: string) => {
    e.stopPropagation();

    const file = files.get(fileId);
    if (file?.isDirty) {
      const confirmed = window.confirm(
        `"${file.name}" has unsaved changes. Close anyway?`
      );
      if (!confirmed) return;
    }

    closeFile(fileId);
  };

  const handleNewTab = () => {
    newFile();
  };

  return (
    <div className="file-tabs">
      <div className="file-tabs-list">
        {filesArray.map((file: OpenFile) => (
          <button
            key={file.id}
            className={`file-tab ${file.id === activeFileId ? 'active' : ''} ${file.isDirty ? 'dirty' : ''}`}
            onClick={() => setActiveFile(file.id)}
            title={file.name}
          >
            <span className="file-tab-name">
              {file.name}
              {file.isDirty && <span className="dirty-indicator">*</span>}
            </span>
            <button
              className="file-tab-close"
              onClick={(e) => handleClose(e, file.id)}
              title="Close"
            >
              ×
            </button>
          </button>
        ))}
      </div>
      <button
        className="file-tab-new"
        onClick={handleNewTab}
        title="New File"
      >
        +
      </button>
    </div>
  );
}
