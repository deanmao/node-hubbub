{
  'targets': [
    {
      'target_name': 'binding',
      'sources': [
        'libhubbub/src/charset/detect.c',
      	'libhubbub/src/parser.c',
      	'libhubbub/src/tokeniser/entities.c',
      	'libhubbub/src/tokeniser/tokeniser.c',
      	'libhubbub/src/treebuilder/after_after_body.c',
      	'libhubbub/src/treebuilder/after_after_frameset.c',
      	'libhubbub/src/treebuilder/after_body.c',
      	'libhubbub/src/treebuilder/after_frameset.c',
      	'libhubbub/src/treebuilder/after_head.c',
      	'libhubbub/src/treebuilder/before_head.c',
      	'libhubbub/src/treebuilder/before_html.c',
      	'libhubbub/src/treebuilder/generic_rcdata.c',
      	'libhubbub/src/treebuilder/in_body.c',
      	'libhubbub/src/treebuilder/in_caption.c',
      	'libhubbub/src/treebuilder/in_cell.c',
      	'libhubbub/src/treebuilder/in_column_group.c',
      	'libhubbub/src/treebuilder/in_foreign_content.c',
      	'libhubbub/src/treebuilder/in_frameset.c',
      	'libhubbub/src/treebuilder/in_head.c',
      	'libhubbub/src/treebuilder/in_head_noscript.c',
      	'libhubbub/src/treebuilder/in_row.c',
      	'libhubbub/src/treebuilder/in_select.c',
      	'libhubbub/src/treebuilder/in_select_in_table.c',
      	'libhubbub/src/treebuilder/in_table.c',
      	'libhubbub/src/treebuilder/in_table_body.c',
      	'libhubbub/src/treebuilder/initial.c',
      	'libhubbub/src/treebuilder/treebuilder.c',
      	'libhubbub/src/utils/errors.c',
      	'libhubbub/src/utils/string.c',
      	'libhubbub/src/tokeniser/entities.inc',
        'libparserutils/src/charset/aliases.c',
      	'libparserutils/src/charset/codec.c',
      	'libparserutils/src/charset/codecs/codec_8859.c',
      	'libparserutils/src/charset/codecs/codec_ascii.c',
      	'libparserutils/src/charset/codecs/codec_ext8.c',
      	'libparserutils/src/charset/codecs/codec_utf16.c',
      	'libparserutils/src/charset/codecs/codec_utf8.c',
      	'libparserutils/src/charset/encodings/utf16.c',
      	'libparserutils/src/charset/encodings/utf8.c',
      	'libparserutils/src/input/filter.c',
      	'libparserutils/src/input/inputstream.c',
      	'libparserutils/src/utils/buffer.c',
      	'libparserutils/src/utils/errors.c',
      	'libparserutils/src/utils/stack.c',
      	'libparserutils/src/utils/vector.c',
      	'libparserutils/src/charset/aliases.inc',
        'src/top.cc',
        'src/mytokeniser.cc'
      ],
      'include_dirs': [
        'libparserutils/include',
        'libhubbub/include',
        'libparserutils/src',
        'libhubbub/src',
        'libparserutils/src/charset',
        'libhubbub/src/charset'
      ],
      'conditions': [
        ['OS=="mac"', {
          'xcode_settings': {
            'GCC_ENABLE_CPP_EXCEPTIONS': 'YES',
            'MACOSX_DEPLOYMENT_TARGET': '10.7'
          }
         }],
        ['OS=="linux"', {
          'cflags_cc': [
            '-fexceptions'
          ]
         }]
      ]
    }
  ]
}
