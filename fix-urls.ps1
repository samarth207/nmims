$files = Get-ChildItem -Path ".\public" -Filter "*.html" -Recurse |
    Where-Object { $_.FullName -notlike "*\admin\*" }

$replacements = [ordered]@{
    'href="../programs/mba-wx-digital-marketing.html"' = 'href="/mba-wx/digital-marketing"'
    'href="../programs/mba-wx-leadership.html"'        = 'href="/mba-wx/leadership"'
    'href="../programs/mba-wx-operations.html"'        = 'href="/mba-wx/operations"'
    'href="../programs/mba-wx-marketing.html"'         = 'href="/mba-wx/marketing"'
    'href="../programs/mba-wx-finance.html"'           = 'href="/mba-wx/finance"'
    'href="../programs/mba-wx-hub.html"'               = 'href="/mba-wx"'
    'href="../programs/bachelors-hub.html"'            = 'href="/bachelors"'
    'href="../programs/bcom.html"'                     = 'href="/bachelors/bcom"'
    'href="../programs/bba.html"'                      = 'href="/bachelors/bba"'
    'href="../programs/mba-online-hub.html"'           = 'href="/online-mba"'
    'href="../mid-senior-professionals.html"'          = 'href="/mid-senior-professionals"'
    'href="../young-professionals.html"'               = 'href="/young-professionals"'
    'href="../undergraduate.html"'                     = 'href="/undergraduate"'
    'href="../all-programs.html"'                      = 'href="/all-programs"'
    'href="../index.html"'                             = 'href="/"'
    'href="../blog.html"'                              = 'href="/blog"'
    'href="../blog/mba-marketing-guide.html"'          = 'href="/blog/mba-marketing-guide"'
    'href="../blog/mba-finance-scope.html"'            = 'href="/blog/mba-finance-scope"'
    'href="../blog/executive-mba-leadership.html"'     = 'href="/blog/executive-mba-leadership"'
    'href="../blog/digital-marketing-career.html"'     = 'href="/blog/digital-marketing-career"'
    'href="../blog/mba-hr-management.html"'            = 'href="/blog/mba-hr-management"'
    'href="programs/mba-wx-digital-marketing.html"'    = 'href="/mba-wx/digital-marketing"'
    'href="programs/mba-wx-leadership.html"'           = 'href="/mba-wx/leadership"'
    'href="programs/mba-wx-operations.html"'           = 'href="/mba-wx/operations"'
    'href="programs/mba-wx-marketing.html"'            = 'href="/mba-wx/marketing"'
    'href="programs/mba-wx-finance.html"'              = 'href="/mba-wx/finance"'
    'href="programs/mba-wx-hub.html"'                  = 'href="/mba-wx"'
    'href="programs/bachelors-hub.html"'               = 'href="/bachelors"'
    'href="programs/bcom.html"'                        = 'href="/bachelors/bcom"'
    'href="programs/bba.html"'                         = 'href="/bachelors/bba"'
    'href="programs/mba-online-hub.html"'              = 'href="/online-mba"'
    'href="mid-senior-professionals.html"'             = 'href="/mid-senior-professionals"'
    'href="young-professionals.html"'                  = 'href="/young-professionals"'
    'href="undergraduate.html"'                        = 'href="/undergraduate"'
    'href="all-programs.html"'                         = 'href="/all-programs"'
    'href="index.html"'                                = 'href="/"'
    'href="blog.html"'                                 = 'href="/blog"'
    'href="mba-marketing-guide.html"'                  = 'href="/blog/mba-marketing-guide"'
    'href="mba-finance-scope.html"'                    = 'href="/blog/mba-finance-scope"'
    'href="executive-mba-leadership.html"'             = 'href="/blog/executive-mba-leadership"'
    'href="digital-marketing-career.html"'             = 'href="/blog/digital-marketing-career"'
    'href="mba-hr-management.html"'                    = 'href="/blog/mba-hr-management"'
    'href="career-options-mba-hr.html"'                = 'href="/blog/career-options-mba-hr"'
    'href="mba-wx-digital-marketing.html"'             = 'href="/mba-wx/digital-marketing"'
    'href="mba-wx-leadership.html"'                    = 'href="/mba-wx/leadership"'
    'href="mba-wx-operations.html"'                    = 'href="/mba-wx/operations"'
    'href="mba-wx-marketing.html"'                     = 'href="/mba-wx/marketing"'
    'href="mba-wx-finance.html"'                       = 'href="/mba-wx/finance"'
    'href="mba-wx-hub.html"'                           = 'href="/mba-wx"'
    'href="bachelors-hub.html"'                        = 'href="/bachelors"'
    'href="bcom.html"'                                 = 'href="/bachelors/bcom"'
    'href="bba.html"'                                  = 'href="/bachelors/bba"'
    'href="mba-online-hub.html"'                       = 'href="/online-mba"'
}

$totalChanges = 0
foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $original = $content
    foreach ($old in $replacements.Keys) {
        $content = $content.Replace($old, $replacements[$old])
    }
    if ($content -ne $original) {
        [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
        $totalChanges++
        Write-Host "Updated: $($file.Name)"
    }
}
Write-Host "Done. $totalChanges file(s) modified."
