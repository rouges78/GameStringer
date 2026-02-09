# -*- coding: utf-8 -*-

################################################################################
# Copyright © 2016-2020 Yukinogatari - Liquid S!
# This work is free. You can redistribute it and/or modify it under the
# terms of the Do What The Fuck You Want To But It's Not My Fault Public
# License, Version 1, as published by Ben McGinnes. See the COPYING file
# for more details.
################################################################################

import os
import math
import shutil

from PyQt4 import QtGui, Qt
from PyQt4.QtGui import QImage, qRed, qGreen, qBlue, qAlpha
from PyQt4.QtCore import QProcess, QString

from util import *

WORKING_DIR = os.path.dirname(os.path.realpath(__file__))

SHTX_MAGIC   = "SHTX"
SHTXFS_MAGIC = "SHTXFS"
SHTXFs_MAGIC = "SHTXFs"
SHTXFF_MAGIC = "SHTXFF"
SHTXFf_MAGIC = "SHTXFf"
TEMP_FILE    = os.path.join(WORKING_DIR, "_temp.png")
QUANT_PATH   = os.path.join(WORKING_DIR, "pngquant")
extension = None
new_file = None

def to_BTX(filename, out_file = None):
  
  if out_file == None:
    out_file = os.path.splitext(filename)[0] + ".btx"
  
  global extension
  
  try:
    os.makedirs(TEMP_DIR)
  except:
    pass
  
  # Convert to indexed.
  if (len(QImage(filename).colorTable()) > 256 or len(QImage(filename).colorTable()) == 0) and not args.SHTXFF and not args.SHTXFf and not ".SHTXFF" in filename and not ".SHTXFf" in filename and not ".shtxff" in filename:
    process = QProcess()
    if args.SHTX or ".SHTX." in out_file or ".shtx." in filename:
      options = ["--force", "--speed", "1", "16", "--output", TEMP_FILE, filename]
    else:
      options = ["--force", "--speed", "1", "256", "--output", TEMP_FILE, filename]
    process.start(QUANT_PATH, options)
    process.waitForFinished(-1)
  
  # If it didn't output anything, the image is already indexed.
  if not os.path.isfile(TEMP_FILE):
    temp_file = filename
  else:
    temp_file = TEMP_FILE
  
  img = QImage(temp_file)
  
  #if not img.format() == QImage.Format_Indexed8:
    #print "Failed to convert", filename
    #print "Couldn't convert image to indexed."
    #print
    #return False
  
  if args.SHTXFs or ".SHTXFs." in filename:
    data = to_SHTXFs(img)
    extension = "SHTXFs"
  elif args.SHTXFf or ".SHTXFf." in out_file:
    data = to_SHTXFf(img)
    extension = "SHTXFf"
  elif args.SHTXFF or ".SHTXFF." in out_file or ".shtxff." in filename:
    data = to_SHTXFF(img)
    extension = "SHTXFF"
  elif args.SHTX or ".SHTX." in out_file or ".shtx." in filename:
    data = to_SHTX(img)
    extension = "SHTX"
  else:
    data = to_SHTXFS(img)
    extension = "SHTXFS"

  if os.path.isfile(TEMP_FILE):
    os.remove(TEMP_FILE)

  if data:
    with open(out_file, "wb") as f:
      f.write(data)
  
    return True
  
  return False

def to_SHTXFS(img):
  
  data = bytearray(SHTXFS_MAGIC)
  
  width  = img.width()
  height = img.height()
  
  data.extend(from_u16(width))
  data.extend(from_u16(height))
  data.append(int(math.ceil(math.log(width, 2))))
  data.append(int(math.ceil(math.log(height, 2))))
  
  pal = img.colorTable()
  if len(pal) < 256:
    pal.extend([0] * (256 - len(pal)))
  
  data = applycolors(data, pal)
  
  data.extend(img.constBits().asstring(width * height))
  
  return data

def to_SHTXFs(img):
  
  data = bytearray(SHTXFs_MAGIC)
  
  width  = img.width()
  height = img.height()
  
  data.extend(from_u16(width))
  data.extend(from_u16(height))
  data.append(int(math.ceil(math.log(width, 2))))
  data.append(int(math.ceil(math.log(height, 2))))
  
  pal = img.colorTable()
  if len(pal) < 256:
    pal.extend([0] * (256 - len(pal)))
  
  for color in pal:
    data.append(qRed(color))
    data.append(qGreen(color))
    data.append(qBlue(color))
    data.append(qAlpha(color))
  
  data.extend(img.constBits().asstring(width * height))
  
  return data

def to_SHTX(img):
  
  data = bytearray(SHTX_MAGIC)
  
  width  = img.width()
  height = img.height()
  
  data.extend(from_u16(width))
  data.extend(from_u16(height))
  data.extend("\x04\x00\x10\x00\x00\x00\x00\x00") # ???
  
  pal = img.colorTable()
  if len(pal) < 16:
    pal.extend([0] * (16 - len(pal)))
  
  data = applycolors(data, pal)
  
  pixels = bytearray(img.constBits().asstring(width * height))
  
  for i in range(0, len(pixels), 2):
    b1, b2 = pixels[i : i + 2]
    b = b1 | (b2 << 4)
    data.append(b)
  
  return data

def to_SHTXFF(img):
  
  data = bytearray(SHTXFF_MAGIC)
  
  width  = img.width()
  height = img.height()
  
  data.extend(from_u16(width))
  data.extend(from_u16(height))
  data.append(int(math.ceil(math.log(width, 2))))
  data.append(int(math.ceil(math.log(height, 2))))
  
  data.extend(img.constBits().asstring(width * (height*4)))
  
  return data

def to_SHTXFf(img):
  
  data = bytearray(SHTXFf_MAGIC)
  
  width  = img.width()
  height = img.height()
  
  data.extend(from_u16(width))
  data.extend(from_u16(height))
  data.append(int(math.ceil(math.log(width, 2))))
  data.append(int(math.ceil(math.log(height, 2))))
  
  data.extend(img.constBits().asstring((width * height) *4))
  
  # while (len(data) % 0x100000) != 0:
   # data.extend(from_u8(0x0))

  return data

def applycolors(data, pal):

 if args.PC:
  for color in pal:
    data.append(qBlue(color))
    data.append(qGreen(color))
    data.append(qRed(color))
    data.append(qAlpha(color))
 else:
  for color in pal:
    data.append(qRed(color))
    data.append(qGreen(color))
    data.append(qBlue(color))
    data.append(qAlpha(color))
 return data
  
if __name__ == "__main__":
  import argparse
  from argparse import RawTextHelpFormatter
  
  print
  print "*************************************************************"
  print "* SHTX/FS converter for PSVITA, written by Yukinogatari.    *"
  print "* Updated by Liquid S! to make it compatible with           *"
  print "* PC games and and SHTXFs, SHTXFF and SHTXFf.               *"
  print "*************************************************************"
  print
  
  parser = argparse.ArgumentParser(description = "Convert PNG images to SHTX/FS/Fs/FF/Ff.\n" +
  "If you don't specify what kind of BTX you need, the program will\n" +
  "automatically try to determine the BTX's type by reading whatever\n"+
  "precedes the file's extension.\n\n"+
  "Ex: 'seq_diff-[0007].SHTXFF.png' will automatically be converted\n"+
  "to an SHTXFF file.\n\n"+
  "Otherwise, if you don't specify anything and the program isn't capable\n"+
  "of determining the file's type, then it will generate an SHTXFS.", formatter_class=RawTextHelpFormatter)
  parser.add_argument("input", metavar = "<input file|dir>", nargs = "+", help = "An input file or directory.")
  parser.add_argument("-o", "--output", metavar = "<output dir>", help = "The output directory.")
  parser.add_argument("-s", "--silence", help = "Let the program work and finish\n"+
  "without giving you any kind of feedback.", action="store_true")
  parser.add_argument("-PC", help = "Specify that you are working with a PC game,\n"+
  "otherwise new files will be built for PSVITA.", action="store_true")
  parser.add_argument("--delete", "-d", help = "Delete the original image after the conversion.", action="store_true")
  parser.add_argument("--SHTX", "-TX", help = "Specify that you need SHTX files.", action="store_true")
  parser.add_argument("--SHTXFS", "-FS", help = "Specify that you need SHTXFS files.", action="store_true")
  parser.add_argument("--SHTXFs", "-Fs", help = "Specify that you need SHTXFs files.", action="store_true")
  parser.add_argument("--SHTXFF", "-FF", help = "Specify that you need SHTXFF files.", action="store_true")
  parser.add_argument("--SHTXFf", "-Ff", help = "Specify that you need SHTXFf files.", action="store_true")
  args = parser.parse_args()
  
  for in_path in args.input:
    
    if os.path.isdir(in_path):
      base_dir = os.path.normpath(in_path)
      files = list_all_files(base_dir)
    elif os.path.isfile(in_path):
      base_dir = os.path.dirname(in_path)
      files = [in_path]
    else:
      continue
    
    if args.output:
      out_dir = os.path.normpath(args.output)
    else:
      out_dir = base_dir
  
    for filename in files:
      if not os.path.splitext(filename)[1].lower() == ".png":
        continue

      out_file = os.path.join(out_dir, filename[len(base_dir) + 1:] if base_dir else filename)

      if os.path.splitext(os.path.splitext(filename)[0])[1] != ".btx":
        out_file = os.path.splitext(out_file)[0] + ".btx"
      else:
        out_file = os.path.splitext(out_file)[0]


      try:
        if to_BTX(filename, out_file) and not args.silence:
          print "---------------------------------------------------"
          print "Original: ", filename
          print "BTX -->", out_file
          print "Type: ", extension
          if args.delete:
            print
            print "The original file has been delete."
          print
          if args.PC:
            print "The BTX files that have been created work only on PC."
            print "Next time don't use '-PC' if you are working with PSVITA's files."			
          else:
            print "The BTX files that have been created work only on PSVITA."
            print "Next time use '-PC' if you are working with PC's files." 
          print
          print "However, keep in mind that SHTXFs and SHTXFF files exist"
          print "only on PC and therefore, even if you omit '-PC',"
          print "this program will always build them specifically for PC."
          print "---------------------------------------------------"
          print		  
      except:
        print
        print "Failed to convert", filename
        print
        if os.path.isfile(TEMP_FILE) and TEMP_FILE != filename:
          os.remove(TEMP_FILE)
        raise
  
    if args.delete:
      os.remove(filename)
  
  if not args.silence:
    print
    raw_input("Press Enter to exit.")

### EOF ###