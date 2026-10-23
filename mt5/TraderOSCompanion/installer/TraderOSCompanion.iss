; Inno Setup 6 script. Build the executable first with build-windows.ps1.
#define MyAppName "TraderOS MT5 Companion"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "TraderOS"
#define MyAppExeName "TraderOSCompanion.exe"

[Setup]
AppId={{6B7E45E4-8E3C-4F9E-94E5-5A8DB5E9C4A1}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\TraderOS MT5 Companion
DefaultGroupName={#MyAppName}
OutputDir=..\dist
OutputBaseFilename=TraderOS-MT5-Companion-Setup
ArchitecturesInstallIn64BitMode=x64
PrivilegesRequired=lowest
WizardStyle=modern
UninstallDisplayIcon={app}\{#MyAppExeName}
CloseApplications=yes

[Files]
Source: "..\dist\TraderOSCompanion.exe"; DestDir: "{app}"; Flags: ignoreversion

[Tasks]
Name: "autostart"; Description: "Start TraderOS automatically when I sign in to Windows"; GroupDescription: "Startup:"; Flags: checkedonce

[Icons]
Name: "{group}\TraderOS MT5 Companion"; Filename: "{app}\{#MyAppExeName}"; Parameters: "--background"
Name: "{userstartup}\TraderOS MT5 Companion"; Filename: "{app}\{#MyAppExeName}"; Parameters: "--background"; Tasks: autostart

[Run]
Filename: "{app}\{#MyAppExeName}"; Parameters: "--background"; Description: "Launch TraderOS MT5 Companion now"; Flags: postinstall nowait skipifsilent
