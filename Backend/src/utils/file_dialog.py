import subprocess
import base64
import os

def _run_powershell_dialog(script_text: str) -> str | None:
    """Run a PowerShell script as an encoded command and return stdout stripped."""
    try:
        # UTF-16LE encoding required for PowerShell -EncodedCommand
        encoded = base64.b64encode(script_text.encode('utf-16le')).decode('utf-8')
        cmd = ["powershell", "-NoProfile", "-NonInteractive", "-EncodedCommand", encoded]
        
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=180
        )
        
        output = result.stdout.strip()
        if output:
            return output
        return None
    except Exception as e:
        print(f"[file_dialog] Dialog error: {e}")
        return None

def show_open_dialog() -> str | None:
    """
    Open native Windows File Explorer Open File Dialog.
    Forces window to TopMost so it appears in the foreground.
    """
    ps_script = """
Add-Type -AssemblyName System.Windows.Forms
$form = New-Object System.Windows.Forms.Form
$form.TopMost = $true
$form.Opacity = 0
$form.ShowInTaskbar = $false
$form.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
$form.Show()
$form.BringToFront()
$form.Activate()

$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = 'Select PDF Document'
$dialog.Filter = 'PDF Files (*.pdf)|*.pdf|All Files (*.*)|*.*'
$dialog.FilterIndex = 1
$dialog.RestoreDirectory = $true
$dialog.Multiselect = $false

$result = $dialog.ShowDialog($form)
$form.Dispose()

if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
    Write-Output $dialog.FileName
}
"""
    output = _run_powershell_dialog(ps_script)
    if output and os.path.exists(output):
        return output
    return None

def show_save_dialog(suggested_name: str = "document.pdf") -> str | None:
    """
    Open native Windows File Explorer Save File Dialog.
    Forces window to TopMost so it appears in the foreground.
    """
    safe_name = suggested_name.replace("'", "").replace('"', '')
    ps_script = """
Add-Type -AssemblyName System.Windows.Forms
$form = New-Object System.Windows.Forms.Form
$form.TopMost = $true
$form.Opacity = 0
$form.ShowInTaskbar = $false
$form.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
$form.Show()
$form.BringToFront()
$form.Activate()

$dialog = New-Object System.Windows.Forms.SaveFileDialog
$dialog.Title = 'Save PDF Document As'
$dialog.Filter = 'PDF Files (*.pdf)|*.pdf|All Files (*.*)|*.*'
$dialog.FilterIndex = 1
$dialog.RestoreDirectory = $true
$dialog.FileName = '__SAFE_NAME__'
$dialog.OverwritePrompt = $true

$result = $dialog.ShowDialog($form)
$form.Dispose()

if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
    Write-Output $dialog.FileName
}
""".replace('__SAFE_NAME__', safe_name)

    output = _run_powershell_dialog(ps_script)
    if output:
        parent_dir = os.path.dirname(output)
        if parent_dir and os.path.exists(parent_dir):
            return output
    return None
