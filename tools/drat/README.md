# Danganronpa: Another Tool (aka DRAT)
### Romhacking tool to mod and translate Danganronpa games (except V3).

If you're planning on translating the games, please consider there are
projects already in process of working on them, which you can also join. 

## List of DR1 (PC) fan-made translations:
- Italian: https://alliceteam.altervista.org/ (by All-Ice Team)
- Spanish: https://tradusquare.es/grupo.php?name=transcene (by TranScene)
- French: https://equipemirai.com/ (by Mirai Team)
- Russian: http://anivisual.net/board/1-1-0-463 (By Проект Монокума (Monokuma Project))
- Portuguese: https://discord.gg/aE7yGJz (by Kibou Project)
- Turkish: https://truthfulroad.wordpress.com/danganronpa-umudun-umutsuz-ogrencileri/ (by Umudun Zirvesi Projesi)

## List of DR2 (PC) fan-made translations:

- Italian: https://alliceteam.altervista.org/ (by All-Ice Team)
- Spanish: https://tradusquare.es/grupo.php?name=transcene (by TranScene)
- French: https://equipemirai.com/ (by Mirai Team)
- Russian: http://anivisual.net/board/1-1-0-877 (By horagema.exe)
- Portuguese: https://discord.gg/aE7yGJz (by Kibou Project)

## List of DR AE (PC - PSVITA) fan-made translations:
- Italian: https://alliceteam.altervista.org/ (by All-Ice Team)
- Spanish: https://tradusquare.es/grupo.php?name=transcene (by TranScene)
- French: https://equipemirai.com/ (by Mirai Team)
- Russian: https://vk.com/pastelcats (by PastelCat's)

-------------------------------------------------------------------------------------

# 1 — Game titles compatible with the DRAT
By using this program, you will be able to extract and repack almost every file from:
- Danganronpa: Trigger Happy Havoc (PSP DEMO - PSP - PSVITA - PC - PS4)
- Danganronpa 2: Goodbye Despair (PSVITA - PC - PS4)
- Danganronpa Another Episode: Ultra Despair Girls (PSVITA - PC - PS4)

I made DRAT with fantranslations and simple mods in mind, therefore if that's what are you aiming for, you should be fine with it.
However if you want to go further and make more articulate mods and do things that you can't do with DRAT (like mod V3), use https://github.com/UnderMybrella/Spiral or https://github.com/jpmac26/DRV3-Tools

-------------------------------------------------------------------------------------

# 2 — Requirements
- .NET Framework 4.7.2: https://support.microsoft.com/en-us/help/4054529/microsoft-net-framework-4-7-2-language-pack-offline-installer-for-wind
- The folder "Ext" has to be next to the tool so that it can work properly.

- ONLY IF YOU NEED TO CONVERT TEXTURES FROM "PNG" TO "BTX"

Python 2.7 (x32): http://www.python.org/download/

PyQt4 (x32): http://www.riverbankcomputing.co.uk/software/pyqt/download

-------------------------------------------------------------------------------------

# 3 — Usage
The program should be intuitive to use, however ".pak" files maybe aren't so easy to
understand, therefore I'll try to give you a quickly explanation about them. 

## "EXTRACT .PAK" and "REPACK .PAK"
There are different ".pak" files, some store textures, while others store texts.
They are a generic archive container, that's why you need to choose correctly the
right type of ".pak" you are going to work on.

- EXTRACT/REPACK ".PAK" TYPE 1: It works for files like "00_System.pak", "26_Menu.pak",
  "mtb_s03.pak", "49_Novel.pak", "mtb2_s06.pak", etc.
  These type of files ".pak" store only text.

- EXTRACT/REPACK ".PAK" TYPE 2: It works for files like "script_pak_e02.pak",
  "script_pak_novel.pak", "script_pak_e07.pak", "novel_ch01.pak", "file_book.pak", etc.
  These type of files ".pak" store ".LIN" files.

- EXTRACT/REPACK ".PAK" TYPE 3: It works for files like "bin_special_font_l.pak",
  "bin_pb_font_l.pak", "bin_sv_font_l.pak", etc.
  These type of files ".pak" recursively store other ".pak" files.
		
- EXTRACT/REPACK TEXTURE ".PAK" W/O CONVERT: It works for all the ".pak" files
  that use to store textures. Textures will be extracted and repacked as they are.

- EXTRACT/REPACK TEXTURE ".PAK" TO PNG: It works for all the ".pak" files that used
  to store textures. Textures will be extracted as ".png" and will automatically
  encoded them back into the right format while repacked back.

## N.B.  
- Use some good PO editor like Poedit to edit the ".PO" files.
  https://poedit.net/
  
- The only tool which you can use to edit the fonts for DR1 and DR2 is the SDSE1:
  https://bitbucket.org/blackdragonhunt/the-super-duper-script-editor

- At the moment the DRAT can't be used to edit anagrams from DR1.

- For specific "reasons" you need to find "psp2gxt.exe" by your own
  and put it inside the "Ext" folder.

-------------------------------------------------------------------------------------

# 4 — Acknowledgements 
- "Yarhl.Media.dll", "Yarhl.dll" and "Mono.Addins.dll" are used to make and read ".PO" files.
Thanks to: https://github.com/SceneGate/Yarhl
  
- "convert.exe" is used to convert textures from ".TGA" to ".PNG" and viceversa.
Thanks to: http://www.imagemagick.org/script/convert.php

- "ScarletTestApp.exe" is used to convert textures from ".GXT" and ".BTX" to ".PNG".
DRAT is using a moded version of Scarlet that I made with the purpose of make it work with DRAT and add new BTX formats.
Thanks to: https://github.com/xdanieldzd/Scarlet
  
- "GIM2PNG.exe" is used to convert textures from ".GIM" to ".PNG".
Thanks to: https://junk2ool.net/tools/psx/start
  
- "psp2gxt.exe" is used to convert textures from ".TGA" to ".GXT".

- "YACpkTool.exe" is used to extract and repack ".CPK" files.
Thanks to: https://github.com/Brolijah/YACpkTool

- "Kontract.dll" is used to decompress and compress files.
Thanks to: https://github.com/IcySon55/Kuriimu
  
- "to_BTX.py" and "util.py" are used to convert textures from ".PNG" to ".BTX".  
I took the original files from yukinogatari and made my own changes, like adding new "BTX" formats.
Thanks to: https://twitter.com/yukinogatari