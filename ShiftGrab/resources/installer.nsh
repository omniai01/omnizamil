; Hide Electron guts after install — leave ShiftGrab.exe (stub) + README + Uninstaller
!macro customInstall
  SetDetailsPrint none
  IfFileExists "$INSTDIR\ShiftGrabReorg.exe" 0 skip_reorg
    ExecWait '"$INSTDIR\ShiftGrabReorg.exe" "$INSTDIR"'
    Delete "$INSTDIR\ShiftGrabReorg.exe"
  skip_reorg:
  Delete "$INSTDIR\uninstallerIcon.ico"
  Delete "$INSTDIR\uninstallerIcon.*"
  IfFileExists "$INSTDIR\.shiftgrab-engine" 0 +2
    nsExec::ExecToLog 'attrib +H +S "$INSTDIR\.shiftgrab-engine"'
  CreateShortCut "$DESKTOP\ShiftGrab.lnk" "$INSTDIR\ShiftGrab.exe" "" "$INSTDIR\ShiftGrab.exe" 0
  CreateShortCut "$SMPROGRAMS\ShiftGrab.lnk" "$INSTDIR\ShiftGrab.exe" "" "$INSTDIR\ShiftGrab.exe" 0
!macroend
