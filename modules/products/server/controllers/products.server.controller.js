'use strict';

/**
 * Module dependencies
 */
var path = require('path'),
  mongoose = require('mongoose'),
  multer = require('multer'),
  config = require(path.resolve('./config/config')),
  Product = mongoose.model('Product'),
  errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller'));

/**
 * Create an Product
 */
exports.create = function (req, res) {
  var product = new Product(req.body);
  product.product = req.product;

  product.save(function (err) {
    if (err) {
      return res.status(422).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {
      res.json(product);
    }
  });
};

/**
 * Show the current product
 */
exports.read = function (req, res) {
  // convert mongoose document to JSON
  var product = req.product ? req.product.toJSON() : {};

  // Add a custom field to the product, for determining if the current User is the "owner".
  // NOTE: This field is NOT persisted to the database, since it doesn't exist in the product model.
  product.isCurrentUserOwner = !!(req.user && product.user && product.user._id.toString() === req.user._id.toString());
  res.json(product);
};

/**
 * Update an product
 */
exports.update = function (req, res) {

  var product = req.product;

  product.title = req.body.title;
  product.content = req.body.content;
  product.image_url = req.body.image_url;

  product.save(function (err) {
    if (err) {
      return res.status(422).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {
      res.json(product);
    }
  });
};

/**
 * Delete an product
 */
exports.delete = function (req, res) {
  var product = req.product;

  product.remove(function (err) {
    if (err) {
      return res.status(422).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {
      res.json(product);
    }
  });
};

/**
 * List of Products
 */
exports.list = function (req, res) {
  Product.find().sort('-created').populate('user', 'displayName').exec(function (err, products) {
    if (err) {
      return res.status(422).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {
      res.json(products);
    }
  });
};

/**
 * Product middleware
 */
exports.productByID = function (req, res, next, id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).send({
      message: 'product is invalid'
    });
  }

  Product.findById(id).populate('user', 'displayName').exec(function (err, product) {
    if (err) {
      return next(err);
    } else if (!product) {
      return res.status(404).send({
        message: 'No product with that identifier has been found'
      });
    }
    req.product = product;
    next();
  });
};

/**
 * Update product image
 */
exports.changeProductImage = function (req, res) {
  console.log('----- changeProductImage -----');
  console.log('- req.product:', req.product);
  //console.log('- req.product:', req.product);
  
  var product = req.product; // TO DO review client side
  var existingImageUrl;

  // Filtering to upload only images
  var multerConfig = config.uploads.product.image;
  multerConfig.fileFilter = require(path.resolve('./config/lib/multer')).imageFileFilter;
  var upload = multer(multerConfig).single('newProductImage');

  if (product) {
    existingImageUrl = product.image_url;
    //console.log('- product:', product);
    uploadImage()
      .then(updateProduct)
      .then(deleteOldImage)
      .then(function () {
        res.json(product);
      })
      .catch(function (err) {
        res.status(422).send(err);
      });
  } else {
    res.status(401).send({
      message: 'User is not signed in'
    });
  }

  function uploadImage () {
    return new Promise(function (resolve, reject) {
      upload(req, res, function (uploadError) {
        if (uploadError) {
          reject(errorHandler.getErrorMessage(uploadError));
        } else {
          resolve();
        }
      });
    });
  }

  function updateProduct () {
    console.log('- NOW - updateProduct:');
    console.log(product);
    return new Promise(function (resolve, reject) {
      product.image_url = config.uploads.product.image.dest + req.file.filename;
      product.save(function (err, theproduct) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  function deleteOldImage () {
    return new Promise(function (resolve, reject) {
      if (existingImageUrl !== Product.schema.path('image_url').defaultValue) {
        fs.unlink(existingImageUrl, function (unlinkError) {
          if (unlinkError) {
            console.log(unlinkError);
            reject({
              message: 'Error occurred while deleting old product image'
            });
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

};