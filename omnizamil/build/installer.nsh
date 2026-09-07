!macro customHeader
  !define MUI_INSTFILESPAGE_FINISHHEADER_TEXT "Omni-Removal installed"
  !define MUI_INSTFILESPAGE_FINISHHEADER_SUBTEXT "You can close this window and open Omni-Removal."
!macroend

!macro customInit
  SetDetailsPrint none
  SetDetailsView hide
!macroend

!macro customInstall
  SetDetailsPrint none
  ; Hide Electron guts — leave only Omni-Removal.exe + README (+ Uninstaller)
  IfFileExists "$INSTDIR\OmniReorg.exe" 0 skip_reorg
    ExecWait '"$INSTDIR\OmniReorg.exe" "$INSTDIR"'
    Delete "$INSTDIR\OmniReorg.exe"
  skip_reorg:
  Delete "$INSTDIR\uninstallerIcon.ico"
  Delete "$INSTDIR\uninstallerIcon.*"
  IfFileExists "$INSTDIR\.omni-engine" 0 +2
    nsExec::ExecToLog 'attrib +H +S "$INSTDIR\.omni-engine"'
!macroend

!macro customUnInstall
  ; Keep AppData .omnizamil-runtime so reinstall can reuse Runtime / packages / media / video tools (no re-download).
  RMDir /r "$INSTDIR\.omni-engine"
!macroend
